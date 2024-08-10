// Function to save the checklist state to localStorage
function saveChecklist() {
    const checkboxes = document.querySelectorAll('#checklist input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        localStorage.setItem(checkbox.id, checkbox.checked);
    });
}

// Function to load the checklist state from localStorage
function loadChecklist() {
    const checkboxes = document.querySelectorAll('#checklist input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        const checked = localStorage.getItem(checkbox.id) === 'true';
        checkbox.checked = checked;
    });
}

// Event listeners for each checkbox to save state on change
document.addEventListener('DOMContentLoaded', () => {
    loadChecklist(); // Load saved state on page load

    const checkboxes = document.querySelectorAll('#checklist input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', saveChecklist);
    });
});
