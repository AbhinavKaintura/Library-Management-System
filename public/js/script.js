// Global variables
let currentPage = 1;
let totalPages = 1;
let bookAttributes = [];

// DOM elements
document.addEventListener('DOMContentLoaded', function() {
    const booksTable = document.getElementById('booksTable');
    const tableHeader = document.getElementById('tableHeader');
    const booksTableBody = document.getElementById('booksTableBody');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageInfo = document.getElementById('pageInfo');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const addBookBtn = document.getElementById('addBookBtn');
    const viewIssuedBooksBtn = document.getElementById('viewIssuedBooksBtn');
    const addBookModal = document.getElementById('addBookModal');
    const addBookForm = document.getElementById('addBookForm');
    const closeModalBtn = document.querySelector('.close');
    const issuedBooksTable = document.getElementById('issuedBooksTable');
    const issuedBooksTableBody = document.getElementById('issuedBooksTableBody');
    
    // Hide the table initially
    if (booksTable) booksTable.style.display = 'none';
    if (issuedBooksTable) issuedBooksTable.style.display = 'none';
    
    // Check if we're on the issued books page
    const isIssuedBooksPage = window.location.pathname.includes('issued-books');
    
    if (isIssuedBooksPage) {
        // If on issued books page, fetch issued books
        fetchIssuedBooks();
    } else {
        // If on main page, fetch regular books
        fetchBookStructure()
            .then(() => {
                fetchBooks(currentPage);
                setupEventListeners();
            })
            .catch(error => {
                console.error('Error initializing application:', error);
                if (loadingIndicator) {
                    loadingIndicator.textContent = 'Error loading books. Please try again later.';
                }
            });
    }

    // Set up event listeners
    function setupEventListeners() {
        // Pagination event listeners
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    fetchBooks(currentPage);
                }
            });
        }
        
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    fetchBooks(currentPage);
                }
            });
        }
        
        // Modal event listeners
        if (addBookBtn) {
            addBookBtn.addEventListener('click', openAddBookModal);
        }
        
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeAddBookModal);
        }
        
        if (addBookModal) {
            window.addEventListener('click', (event) => {
                if (event.target === addBookModal) {
                    closeAddBookModal();
                }
            });
        }
        
        // View issued books button
        if (viewIssuedBooksBtn) {
            viewIssuedBooksBtn.addEventListener('click', () => {
                window.location.href = '/issued-books';
            });
        }
        
        // Form submission
        if (addBookForm) {
            addBookForm.addEventListener('submit', handleAddBookSubmit);
        }
    }
});

// Fetch book structure to get column names
async function fetchBookStructure() {
    try {
        const response = await fetch('/api/books/structure');
        if (!response.ok) {
            throw new Error('Failed to fetch book structure');
        }
        
        const data = await response.json();
        bookAttributes = data.attributes;
        
        // Create table headers based on book attributes
        createTableHeaders();
        
        // Create form fields for adding new books
        createFormFields();
        
    } catch (error) {
        console.error('Error fetching book structure:', error);
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.textContent = 'Error loading book structure. Please try again later.';
        }
    }
}

// Create table headers based on book attributes
function createTableHeaders() {
    const tableHeader = document.getElementById('tableHeader');
    if (!tableHeader) return;
    
    tableHeader.innerHTML = '';
    
    // Add book attribute columns
    bookAttributes.forEach(attr => {
        const th = document.createElement('th');
        th.textContent = formatAttributeName(attr);
        tableHeader.appendChild(th);
    });
    
    // Add action column for issue button
    const actionTh = document.createElement('th');
    actionTh.textContent = 'Actions';
    tableHeader.appendChild(actionTh);
}

// Create form fields for adding new books
function createFormFields() {
    const addBookForm = document.getElementById('addBookForm');
    if (!addBookForm) return;
    
    // Clear existing form fields, but keep the submit button
    addBookForm.innerHTML = '';
    
    bookAttributes.forEach(attr => {
        // Skip id field as it's usually auto-generated
        if (attr.toLowerCase() === 'id') return;
        // Skip status, issued_to, and issued_date fields
        if (['status', 'issued_to', 'issued_date'].includes(attr.toLowerCase())) return;
        
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        const label = document.createElement('label');
        label.setAttribute('for', attr);
        label.textContent = formatAttributeName(attr);
        
        const input = document.createElement('input');
        input.setAttribute('type', getInputTypeForAttribute(attr));
        input.setAttribute('id', attr);
        input.setAttribute('name', attr);
        
        // Make only essential fields required
        if (['title', 'author', 'isbn'].includes(attr.toLowerCase())) {
            input.required = true;
        }
        
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        addBookForm.appendChild(formGroup);
    });
    
    // Add submit button
    const submitBtnGroup = document.createElement('div');
    submitBtnGroup.className = 'form-group';
    
    const newSubmitBtn = document.createElement('button');
    newSubmitBtn.setAttribute('type', 'submit');
    newSubmitBtn.className = 'submit-btn';
    newSubmitBtn.textContent = 'Add Book';
    
    submitBtnGroup.appendChild(newSubmitBtn);
    addBookForm.appendChild(submitBtnGroup);
}

// Format attribute name for display (e.g., "book_title" -> "Book Title")
function formatAttributeName(attr) {
    return attr
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Get appropriate input type based on attribute name
function getInputTypeForAttribute(attr) {
    const lowerAttr = attr.toLowerCase();
    
    if (lowerAttr.includes('date')) return 'date';
    if (lowerAttr.includes('year')) return 'number';
    if (lowerAttr.includes('price') || lowerAttr.includes('cost')) return 'number';
    if (lowerAttr.includes('quantity') || lowerAttr.includes('count') || lowerAttr.includes('copies')) return 'number';
    
    return 'text';
}

// Fetch books for a specific page
async function fetchBooks(page) {
    try {
        const loadingIndicator = document.getElementById('loadingIndicator');
        const booksTable = document.getElementById('booksTable');
        
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (booksTable) booksTable.style.display = 'none';
        
        const response = await fetch(`/api/books?page=${page}`);
        if (!response.ok) {
            throw new Error('Failed to fetch books');
        }
        
        const data = await response.json();
        renderBooks(data.books);
        updatePagination(data.currentPage, data.totalPages);
        
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (booksTable) booksTable.style.display = 'table';
        
    } catch (error) {
        console.error('Error fetching books:', error);
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.textContent = 'Error loading books. Please try again later.';
        }
    }
}

// Fetch issued books
async function fetchIssuedBooks() {
    try {
        const loadingIndicator = document.getElementById('loadingIndicator');
        const issuedBooksTable = document.getElementById('issuedBooksTable');
        
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (issuedBooksTable) issuedBooksTable.style.display = 'none';
        
        const response = await fetch('/api/books/issued');
        if (!response.ok) {
            throw new Error('Failed to fetch issued books');
        }
        
        const data = await response.json();
        renderIssuedBooks(data.issuedBooks);
        
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (issuedBooksTable) issuedBooksTable.style.display = 'table';
        
    } catch (error) {
        console.error('Error fetching issued books:', error);
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.textContent = 'Error loading issued books. Please try again later.';
        }
    }
}

// Render books in the table
function renderBooks(books) {
    const booksTableBody = document.getElementById('booksTableBody');
    if (!booksTableBody) return;
    
    booksTableBody.innerHTML = '';
    
    if (!books || books.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.textContent = 'No books found';
        emptyCell.colSpan = bookAttributes.length + 1; // +1 for the action column
        emptyCell.style.textAlign = 'center';
        emptyRow.appendChild(emptyCell);
        booksTableBody.appendChild(emptyRow);
        return;
    }
    
    books.forEach(book => {
        const row = document.createElement('tr');
        
        bookAttributes.forEach(attr => {
            const cell = document.createElement('td');
            cell.textContent = book[attr] !== null ? book[attr] : '';
            row.appendChild(cell);
        });
        
        // Add issue button cell
        const actionCell = document.createElement('td');
        
        // Check if the book is already issued
        if (book.status === 'issued') {
            actionCell.textContent = 'Currently issued';
            actionCell.className = 'unavailable-text';
        } else {
            const issueBtn = document.createElement('button');
            issueBtn.className = 'issue-btn';
            issueBtn.textContent = 'Issue Book';
            issueBtn.addEventListener('click', () => showIssueDialog(book.id, book.title));
            actionCell.appendChild(issueBtn);
        }
        
        row.appendChild(actionCell);
        booksTableBody.appendChild(row);
    });
}

// Show dialog to collect user information before issuing a book
function showIssueDialog(bookId, bookTitle) {
    // Create modal dialog
    const dialogOverlay = document.createElement('div');
    dialogOverlay.className = 'modal';
    dialogOverlay.style.display = 'block';
    
    const dialogContent = document.createElement('div');
    dialogContent.className = 'modal-content';
    
    // Close button
    const closeBtn = document.createElement('span');
    closeBtn.className = 'close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = function() {
        document.body.removeChild(dialogOverlay);
    };
    
    // Title
    const title = document.createElement('h2');
    title.textContent = `Issue Book: ${bookTitle}`;
    
    // Form
    const form = document.createElement('form');
    form.id = 'issueBookForm';
    
    // User ID field
    const userIdGroup = document.createElement('div');
    userIdGroup.className = 'form-group';
    
    const userIdLabel = document.createElement('label');
    userIdLabel.setAttribute('for', 'user_id');
    userIdLabel.textContent = 'User ID';
    
    const userIdInput = document.createElement('input');
    userIdInput.setAttribute('type', 'text');
    userIdInput.setAttribute('id', 'user_id');
    userIdInput.setAttribute('name', 'user_id');
    userIdInput.required = true;
    
    userIdGroup.appendChild(userIdLabel);
    userIdGroup.appendChild(userIdInput);
    
    // User Name field
    const userNameGroup = document.createElement('div');
    userNameGroup.className = 'form-group';
    
    const userNameLabel = document.createElement('label');
    userNameLabel.setAttribute('for', 'user_name');
    userNameLabel.textContent = 'User Name';
    
    const userNameInput = document.createElement('input');
    userNameInput.setAttribute('type', 'text');
    userNameInput.setAttribute('id', 'user_name');
    userNameInput.setAttribute('name', 'user_name');
    userNameInput.required = true;
    
    userNameGroup.appendChild(userNameLabel);
    userNameGroup.appendChild(userNameInput);
    
    // Submit button
    const submitBtnGroup = document.createElement('div');
    submitBtnGroup.className = 'form-group';
    
    const submitBtn = document.createElement('button');
    submitBtn.setAttribute('type', 'submit');
    submitBtn.className = 'submit-btn';
    submitBtn.textContent = 'Issue Book';
    
    submitBtnGroup.appendChild(submitBtn);
    
    // Add all elements to form
    form.appendChild(userIdGroup);
    form.appendChild(userNameGroup);
    form.appendChild(submitBtnGroup);
    
    // Form submission handler
    form.onsubmit = function(e) {
        e.preventDefault();
        issueBook(bookId, userIdInput.value, userNameInput.value);
        document.body.removeChild(dialogOverlay);
    };
    
    // Assemble dialog
    dialogContent.appendChild(closeBtn);
    dialogContent.appendChild(title);
    dialogContent.appendChild(form);
    dialogOverlay.appendChild(dialogContent);
    
    // Add to document
    document.body.appendChild(dialogOverlay);
}

// Render issued books in the table
function renderIssuedBooks(issuedBooks) {
    const issuedBooksTableBody = document.getElementById('issuedBooksTableBody');
    if (!issuedBooksTableBody) return;
    
    issuedBooksTableBody.innerHTML = '';
    
    if (!issuedBooks || issuedBooks.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.textContent = 'No issued books found';
        emptyCell.colSpan = 8; // Update this to match the number of columns in the issued books table
        emptyCell.style.textAlign = 'center';
        emptyRow.appendChild(emptyCell);
        issuedBooksTableBody.appendChild(emptyRow);
        return;
    }
    
    issuedBooks.forEach(book => {
        const row = document.createElement('tr');
        
        // Create cells for book details
        const titleCell = document.createElement('td');
        titleCell.textContent = book.title || '';
        row.appendChild(titleCell);
        
        const authorCell = document.createElement('td');
        authorCell.textContent = book.author || '';
        row.appendChild(authorCell);
        
        // Add user ID
        const userIdCell = document.createElement('td');
        userIdCell.textContent = book.user_id || '';
        row.appendChild(userIdCell);
        
        // Add user name
        const userNameCell = document.createElement('td');
        userNameCell.textContent = book.user_name || '';
        row.appendChild(userNameCell);
        
        // Format the issue date
        const issueDateCell = document.createElement('td');
        if (book.issue_date) {
            const issueDate = new Date(book.issue_date);
            issueDateCell.textContent = issueDate.toLocaleDateString();
        } else {
            issueDateCell.textContent = '';
        }
        row.appendChild(issueDateCell);
        
        // Calculate due date (assuming 14 days loan period)
        const dueDateCell = document.createElement('td');
        if (book.issue_date) {
            const issueDate = new Date(book.issue_date);
            const dueDate = new Date(issueDate);
            dueDate.setDate(dueDate.getDate() + 14); // 14 days loan period
            dueDateCell.textContent = dueDate.toLocaleDateString();
        } else {
            dueDateCell.textContent = '';
        }
        row.appendChild(dueDateCell);
        
        // Status cell
        const statusCell = document.createElement('td');
        statusCell.textContent = 'Issued';
        row.appendChild(statusCell);
        
        // Add return button cell
        const actionCell = document.createElement('td');
        const returnBtn = document.createElement('button');
        returnBtn.className = 'return-btn';
        returnBtn.textContent = 'Return Book';
        returnBtn.addEventListener('click', () => returnBook(book.book_id));
        actionCell.appendChild(returnBtn);
        
        row.appendChild(actionCell);
        issuedBooksTableBody.appendChild(row);
    });
}

// Issue a book
async function issueBook(bookId, userId, userName) {
    try {
        const response = await fetch('/api/books/issue', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                book_id: bookId,
                user_id: userId,
                user_name: userName
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to issue book');
        }
        
        const result = await response.json();
        
        // Refresh books list after issuing
        fetchBooks(currentPage);
        
        // Show success message
        alert('Book issued successfully!');
        
    } catch (error) {
        console.error('Error issuing book:', error);
        alert(error.message || 'Error issuing book. Please try again.');
    }
}

// Return a book
async function returnBook(bookId) {
    try {
        const response = await fetch('/api/books/return', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ book_id: bookId })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to return book');
        }
        
        // Refresh issued books list after returning
        fetchIssuedBooks();
        
        // Show success message
        alert('Book returned successfully!');
        
    } catch (error) {
        console.error('Error returning book:', error);
        alert(error.message || 'Error returning book. Please try again.');
    }
}

// Update pagination controls
function updatePagination(currentPage, totalPages) {
    const pageInfo = document.getElementById('pageInfo');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    
    if (!pageInfo || !prevPageBtn || !nextPageBtn) return;
    
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
    
    // Update global variables
    window.currentPage = currentPage;
    window.totalPages = totalPages;
}

// Open the add book modal
function openAddBookModal() {
    const addBookModal = document.getElementById('addBookModal');
    const addBookForm = document.getElementById('addBookForm');
    
    if (addBookModal) addBookModal.style.display = 'block';
    if (addBookForm) addBookForm.reset();
}

// Close the add book modal
function closeAddBookModal() {
    const addBookModal = document.getElementById('addBookModal');
    if (addBookModal) addBookModal.style.display = 'none';
}

// Handle add book form submission
async function handleAddBookSubmit(event) {
    event.preventDefault();
    
    const addBookForm = document.getElementById('addBookForm');
    if (!addBookForm) return;
    
    const formData = new FormData(addBookForm);
    const bookData = {};
    
    // Convert form data to JSON object
    for (const [key, value] of formData.entries()) {
        bookData[key] = value;
    }
    
    try {
        const response = await fetch('/api/books', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bookData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to add book');
        }
        
        // Close modal and refresh books list
        closeAddBookModal();
        fetchBooks(1); // Go back to first page to see the new book
        
        // Show success message
        alert('Book added successfully!');
        
    } catch (error) {
        console.error('Error adding book:', error);
        alert('Error adding book. Please try again.');
    }
}