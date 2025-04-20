//express server for library management system

import express from "express";
import bodyParser from "body-parser";
import { dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import env from "dotenv";

// Initialize environment variables
env.config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));

// Database connection
const db = new pg.Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});

db.connect()
    .then(() => console.log("Connected to PostgreSQL database"))
    .catch(err => console.error("Error connecting to database:", err));

// Routes
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

app.get("/issued-books", (req, res) => {
    res.sendFile(__dirname + "/public/issued-books.html");
});

// API to get book structure (column names)
app.get("/api/books/structure", async (req, res) => {
    try {
        // Query to get column information from the books table
        const query = `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'books'
            ORDER BY ordinal_position
        `;
        
        const result = await db.query(query);
        
        // Extract column names
        const attributes = result.rows.map(row => row.column_name);
        
        res.json({
            success: true,
            attributes: attributes
        });
    } catch (error) {
        console.error("Error fetching book structure:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching book structure",
            error: error.message
        });
    }
});

// API to get books with pagination
app.get("/api/books", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 50; // 50 books per page
        const offset = (page - 1) * limit;
        
        // Get total count of books
        const countResult = await db.query("SELECT COUNT(*) FROM books");
        const totalBooks = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalBooks / limit);
        
        // Get books for the current page
        const booksQuery = `
            SELECT * FROM books
            ORDER BY id
            LIMIT $1 OFFSET $2
        `;
        
        const booksResult = await db.query(booksQuery, [limit, offset]);
        
        res.json({
            success: true,
            currentPage: page,
            totalPages: totalPages,
            totalBooks: totalBooks,
            books: booksResult.rows
        });
    } catch (error) {
        console.error("Error fetching books:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching books",
            error: error.message
        });
    }
});

// API to add a new book
app.post("/api/books", async (req, res) => {
    try {
        const bookData = req.body;
        
        // Get column names from the books table
        const columnsQuery = `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'books'
            AND column_name != 'id' -- Exclude ID as it's usually auto-generated
        `;
        
        const columnsResult = await db.query(columnsQuery);
        const columns = columnsResult.rows.map(row => row.column_name);
        
        // Filter the book data to only include valid columns
        const validColumns = columns.filter(column => bookData[column] !== undefined);
        
        if (validColumns.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid book data provided"
            });
        }
        
        // Build the INSERT query dynamically
        const columnList = validColumns.join(", ");
        const valuePlaceholders = validColumns.map((_, index) => `$${index + 1}`).join(", ");
        const values = validColumns.map(column => bookData[column]);
        
        const insertQuery = `
            INSERT INTO books (${columnList})
            VALUES (${valuePlaceholders})
            RETURNING *
        `;
        
        const result = await db.query(insertQuery, values);
        
        res.status(201).json({
            success: true,
            message: "Book added successfully",
            book: result.rows[0]
        });
    } catch (error) {
        console.error("Error adding book:", error);
        res.status(500).json({
            success: false,
            message: "Error adding book",
            error: error.message
        });
    }
});

// API to issue a book to a user
app.post("/api/books/issue", async (req, res) => {
    const { book_id, user_id, user_name } = req.body;
    
    if (!book_id || !user_id || !user_name) {
        return res.status(400).json({
            success: false,
            message: "Book ID, User ID, and User Name are required"
        });
    }
    
    // Start a transaction to ensure data consistency
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if the book exists and is available
        const bookQuery = `
            SELECT * FROM books 
            WHERE id = $1 AND (status IS NULL OR status = 'available')
        `;
        const bookResult = await client.query(bookQuery, [book_id]);
        
        if (bookResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: "Book not found or already issued"
            });
        }
        
        // Update the book status to 'issued'
        const updateBookQuery = `
            UPDATE books 
            SET status = 'issued', 
                issued_to = $1, 
                issued_date = CURRENT_TIMESTAMP 
            WHERE id = $2
            RETURNING *
        `;
        const updateResult = await client.query(updateBookQuery, [user_id, book_id]);
        
        // Insert into book_issues table to maintain history
        const issueQuery = `
            INSERT INTO book_issues (book_id, user_id, user_name, issue_date)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            RETURNING *
        `;
        const issueResult = await client.query(issueQuery, [book_id, user_id, user_name]);
        
        await client.query('COMMIT');
        
        res.status(200).json({
            success: true,
            message: "Book issued successfully",
            book: updateResult.rows[0],
            issue: issueResult.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error issuing book:", error);
        res.status(500).json({
            success: false,
            message: "Error issuing book",
            error: error.message
        });
    } finally {
        client.release();
    }
});

// API to return a book
app.post("/api/books/return", async (req, res) => {
    const { book_id } = req.body;
    
    if (!book_id) {
        return res.status(400).json({
            success: false,
            message: "Book ID is required"
        });
    }
    
    // Start a transaction
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if the book exists and is issued
        const bookQuery = `
            SELECT * FROM books 
            WHERE id = $1 AND status = 'issued'
        `;
        const bookResult = await client.query(bookQuery, [book_id]);
        
        if (bookResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: "Book not found or not currently issued"
            });
        }
        
        // Get the current issue record to update it
        const issueQuery = `
            SELECT * FROM book_issues 
            WHERE book_id = $1 AND return_date IS NULL
            ORDER BY issue_date DESC 
            LIMIT 1
        `;
        const issueResult = await client.query(issueQuery, [book_id]);
        
        if (issueResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: "Issue record not found"
            });
        }
        
        // Update the book status to 'available'
        const updateBookQuery = `
            UPDATE books 
            SET status = 'available', 
                issued_to = NULL, 
                issued_date = NULL 
            WHERE id = $1
            RETURNING *
        `;
        const updateResult = await client.query(updateBookQuery, [book_id]);
        
        // Update the issue record with return date
        const updateIssueQuery = `
            UPDATE book_issues 
            SET return_date = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `;
        const updateIssueResult = await client.query(updateIssueQuery, [issueResult.rows[0].id]);
        
        await client.query('COMMIT');
        
        res.status(200).json({
            success: true,
            message: "Book returned successfully",
            book: updateResult.rows[0],
            issue: updateIssueResult.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error returning book:", error);
        res.status(500).json({
            success: false,
            message: "Error returning book",
            error: error.message
        });
    } finally {
        client.release();
    }
});

// API to get all issued books
app.get("/api/books/issued", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 50; // 50 books per page
        const offset = (page - 1) * limit;
        
        // Get total count of issued books
        const countQuery = `
            SELECT COUNT(*) FROM books 
            WHERE status = 'issued'
        `;
        const countResult = await db.query(countQuery);
        const totalBooks = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalBooks / limit);
        
        // Get issued books for the current page
        const booksQuery = `
            SELECT b.*, 
                   i.user_name, 
                   i.issue_date
            FROM books b
            JOIN book_issues i ON b.id = i.book_id
            WHERE b.status = 'issued' AND i.return_date IS NULL
            ORDER BY i.issue_date DESC
            LIMIT $1 OFFSET $2
        `;
        
        const booksResult = await db.query(booksQuery, [limit, offset]);
        
        res.json({
            success: true,
            currentPage: page,
            totalPages: totalPages,
            totalIssuedBooks: totalBooks,
            issuedBooks: booksResult.rows
        });
    } catch (error) {
        console.error("Error fetching issued books:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching issued books",
            error: error.message
        });
    }
});

// API to get issue history
app.get("/api/books/issue-history", async (req, res) => {
    try {
        const { book_id, user_id } = req.query;
        
        let query = `
            SELECT i.*, b.title, b.author
            FROM book_issues i
            JOIN books b ON i.book_id = b.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramCounter = 1;
        
        if (book_id) {
            query += ` AND i.book_id = $${paramCounter}`;
            params.push(book_id);
            paramCounter++;
        }
        
        if (user_id) {
            query += ` AND i.user_id = $${paramCounter}`;
            params.push(user_id);
            paramCounter++;
        }
        
        query += ` ORDER BY i.issue_date DESC`;
        
        const result = await db.query(query, params);
        
        res.json({
            success: true,
            issueHistory: result.rows
        });
    } catch (error) {
        console.error("Error fetching issue history:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching issue history",
            error: error.message
        });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Library Management System running at http://localhost:${port}`);
});