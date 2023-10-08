document.addEventListener("DOMContentLoaded", function() {
    // Constants for DOM elements
    const websiteUrl = document.querySelector("#websiteUrl");
    const delaySlider = document.querySelector("#delaySlider");
    const delayValue = document.querySelector("#delayValue");
    const submitButton = document.querySelector("#submitButton");
    const saveButton = document.querySelector("#saveButton");
    const apiUrlInput = document.querySelector("#apiUrl");
    const apiKeyInput = document.querySelector("#apiKey");
    const formatButtons = document.querySelectorAll("#formatBtnGroup button");
    const screenshotSpinner = document.querySelector("#screenshotSpinner");
    const errorContainer = document.querySelector("#errorContainer");
    const resultContainer = document.querySelector("#resultContainer");
    const settingsContent = document.querySelector('#settingsContent');

    // Constants for storage values
    const storedApiUrl = localStorage.getItem("apiUrl") || sessionStorage.getItem("apiUrl");
    const storedApiKey = localStorage.getItem("apiKey") || sessionStorage.getItem("apiKey");

    // Initially disable the saveButton
    saveButton.disabled = true;

    // Add event listener for "Enter" keystroke on the URL input
    websiteUrl.addEventListener("keypress", function(e) {
        if (e.keyCode === 13) { 
            e.preventDefault();
            submitButton.click();
        }
    });

    // Event listener for the delay slider input
    delaySlider.addEventListener("input", function() {
        const delaySeconds = delaySlider.value;
        delayValue.textContent = `${delaySeconds} ${delaySeconds == 1 ? 'second' : 'seconds'}`;
    });

    // Format button behavior
    formatButtons.forEach(button => {
        button.addEventListener("click", function() {
            button.parentElement.querySelectorAll("button").forEach(sibling => {
                sibling.classList.remove("btn-primary");
                sibling.classList.add("btn-secondary");
            });
            button.classList.remove("btn-secondary");
            button.classList.add("btn-primary");
        });
    });

    // Load the API settings from either local storage or session storage
    if (storedApiUrl) {
        apiUrlInput.value = storedApiUrl;
    }
    if (storedApiKey) {
        apiKeyInput.value = storedApiKey;
    }

    // Check if settings are absent in both local and session storage
    if (!storedApiUrl) {
        const apiSettingsModal = new bootstrap.Modal(document.querySelector('#apiSettingsModal'));
        apiSettingsModal.show();
    }

    // Function to display error messages
    function displayErrorMessage(message) {
        errorContainer.innerHTML = `
            <div class="alert alert-danger alert-dismissible fade show mb-3 mt-15" role="alert">
                <div class="d-flex align-items-center">
                    <i class="fas fa-exclamation-triangle me-2 pb-2"></i>
                    <h4>Application Error</h4>
                </div>
                <p>${message}</p>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        errorContainer.style.display = 'block';
    }

    // Function to handle the screenshot request
    submitButton.addEventListener("click", function(e) {
        e.preventDefault();

        const apiUrl = apiUrlInput.value;
        const apiKey = apiKeyInput.value;
        const websiteUrlValue = websiteUrl.value;
        const viewport = document.querySelector("#viewport").value || "1440x900";
        const format = document.querySelector("#formatBtnGroup .btn-primary").dataset.format || "PNG";
        const delay = delaySlider.value || "1";

        // Validation
        if (!apiUrl.trim()) {
            displayErrorMessage("Please provide an API URL.");
            return;
        }
        if (!websiteUrlValue.trim()) {
            displayErrorMessage("Please provide a website URL.");
            return;
        }
        if (viewport && !/^\d+x\d+$/.test(viewport)) {
            displayErrorMessage("Invalid viewport format. It should be like 1440x900.");
            return;
        }

        // Collapse the settings div if it's open
        settingsContent.classList.remove('show');

        // Disable the saveButton and show the spinner
        saveButton.disabled = true;
        screenshotSpinner.style.display = "inline-block";
        submitButton.disabled = true;

        let requestUrl = `${apiUrl}/screenshot?url=${encodeURIComponent(websiteUrlValue)}`;

        if (viewport) requestUrl += `&viewport=${viewport}`;
        if (format) requestUrl += `&format=${format}`;
        if (delay) requestUrl += `&delay=${delay}`;

        const headers = {
            "Authorization": `Bearer ${apiKey}`
        };

        axios.get(requestUrl, { headers, responseType: 'blob' })
        .then(response => {
            const imageUrl = URL.createObjectURL(response.data);
            errorContainer.style.display = 'none'; 
            resultContainer.innerHTML = `<a href="${imageUrl}" target="_blank" rel="noopener noreferrer"><img src="${imageUrl}" style="display: none;" /></a>`;
            const resultImg = resultContainer.querySelector("img");
            resultImg.style.display = 'block';
            
            setTimeout(() => {
                window.scrollTo({ 
                    top: userForm.offsetTop, 
                    behavior: 'smooth' 
                });
            }, 50);  // Delay the scroll by 50 milliseconds
        
            saveButton.disabled = false;
        })        
        .catch(error => {
            let errorMessage = 'There was an issue capturing the screenshot.';
            if (error && error.response && error.response.data && error.response.data.message) {
                errorMessage = error.response.data.message;
            }
            displayErrorMessage(errorMessage);
        })
        .finally(() => {
            screenshotSpinner.style.display = 'none';
            submitButton.disabled = false;
        });
    });

    // Function to trigger the download of the image
    saveButton.addEventListener("click", function(e) {
        e.preventDefault();

        const format = document.querySelector("#formatBtnGroup .btn-primary").dataset.format || "PNG";
        const imageUrl = resultContainer.querySelector("img").getAttribute('src');
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 10).replace(/-/g, '') + '-' + now.toISOString().slice(11, 19).replace(/:/g, '');
        const link = document.createElement('a');

        link.href = imageUrl;
        link.download = `screenshot-${timestamp}.${format}`;
        link.click();
    });

    // Function to handle the settings save
    document.querySelector("#apiSettingsModal .btn-primary").addEventListener("click", function(e) {
        if (document.querySelector("#saveSettingsCheckbox").checked) {
            localStorage.setItem("apiUrl", apiUrlInput.value);
            localStorage.setItem("apiKey", apiKeyInput.value);
        } else {
            sessionStorage.setItem("apiUrl", apiUrlInput.value);
            sessionStorage.setItem("apiKey", apiKeyInput.value);
        }
    });
});
