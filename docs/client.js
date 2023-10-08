document.addEventListener("DOMContentLoaded", function() {

    // Add event listener for "Enter" keystroke on the URL input
    const websiteUrl = document.querySelector("#websiteUrl");
    websiteUrl.addEventListener("keypress", function(e) {
        if (e.keyCode === 13) { 
            e.preventDefault();
            document.querySelector("#submitButton").click();
        }
    });

    // Event listener for the delay slider input
    const delaySlider = document.querySelector("#delaySlider");
    const delayValue = document.querySelector("#delayValue");

    delaySlider.addEventListener("input", function() {
        const delaySeconds = delaySlider.value;
        delayValue.textContent = `${delaySeconds} ${delaySeconds == 1 ? 'second' : 'seconds'}`;
    });

    // Format button behavior
    document.querySelectorAll("#formatBtnGroup button").forEach(button => {
        button.addEventListener("click", function() {
            button.parentElement.querySelectorAll("button").forEach(sibling => {
                sibling.classList.remove("btn-primary");
                sibling.classList.add("btn-secondary");
            });
            button.classList.remove("btn-secondary");
            button.classList.add("btn-primary");
            document.querySelector("#format").value = button.dataset.format;
        });
    });

    // Load the API settings from either local storage or session storage
    const storedApiUrl = localStorage.getItem("apiUrl") || sessionStorage.getItem("apiUrl");
    const storedApiKey = localStorage.getItem("apiKey") || sessionStorage.getItem("apiKey");

    if (storedApiUrl) {
        document.querySelector("#apiUrl").value = storedApiUrl;
    }

    if (storedApiKey) {
        document.querySelector("#apiKey").value = storedApiKey;
    }

    // Check if settings are absent in both local and session storage
    if (!storedApiUrl) {
        const apiSettingsModal = new bootstrap.Modal(document.querySelector('#apiSettingsModal'));
        apiSettingsModal.show();
    }

    // Initially disable the saveButton
    document.querySelector("#saveButton").disabled = true;

    // Function to trigger the download of the image
    document.querySelector("#saveButton").addEventListener("click", function(e) {
        e.preventDefault();

        const format = document.querySelector("#formatBtnGroup .btn-primary").dataset.format || "png";
        const imageUrl = document.querySelector("#resultContainer img").getAttribute('src');
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 10).replace(/-/g, '') + '-' + now.toISOString().slice(11, 19).replace(/:/g, '');
        const link = document.createElement('a');

        link.href = imageUrl;
        link.download = `screenshot-${timestamp}.${format}`;
        link.click();
    });

    // Function to handle the screenshot request
    document.querySelector("#submitButton").addEventListener("click", function(e) {
        e.preventDefault();

        const apiUrlForValidation = document.querySelector("#apiUrl").value;
        const websiteUrlForValidation = document.querySelector("#websiteUrl").value;
        const viewportForValidation = document.querySelector("#viewport").value;

        if (!apiUrlForValidation.trim()) {
            displayErrorMessage("Please provide an API URL.");
            return;
        }

        if (!websiteUrlForValidation.trim()) {
            displayErrorMessage("Please provide a website URL.");
            return;
        }

        if (viewportForValidation && !/^\d+x\d+$/.test(viewportForValidation)) {
            displayErrorMessage("Invalid viewport format. It should be like 1280x960.");
            return;
        }

        // Collapse the settings div if it's open
        document.querySelector('#settingsContent').classList.remove('show');

        // Disable the saveButton until the new screenshot is loaded
        document.querySelector("#saveButton").disabled = true;

        // Show the spinner and disable the submitButton
        document.querySelector("#screenshotSpinner").style.display = "inline-block";
        document.querySelector("#submitButton").disabled = true;

        // Get input values
        const apiUrl = document.querySelector("#apiUrl").value;
        const apiKey = document.querySelector("#apiKey").value;
        const websiteUrl = encodeURIComponent(document.querySelector("#websiteUrl").value);
        const viewport = document.querySelector("#viewport").value || "1280x960";
        const format = document.querySelector("#formatBtnGroup .btn-primary").dataset.format || "png";
        const delay = document.querySelector("#delaySlider").value || "1";

        // Base request URL
        let requestUrl = `${apiUrl}/screenshot?url=${websiteUrl}`;

        // Conditionally append parameters if they have values
        if (viewport) {
            requestUrl += `&viewport=${viewport}`;
        }
        if (format) {
            requestUrl += `&format=${format}`;
        }
        if (delay) {
            requestUrl += `&delay=${delay}`;
        }

        // Construct the headers
        const headers = {
            "Authorization": `Bearer ${apiKey}`
        };

        axios.get(requestUrl, {
            headers: headers,
            responseType: 'blob'
        })
        .then(response => {
            const imageUrl = URL.createObjectURL(response.data);
            document.querySelector("#errorContainer").style.display = 'none';
            document.querySelector("#resultContainer").innerHTML = `<a href="${imageUrl}" target="_blank" rel="noopener noreferrer"><img src="${imageUrl}" style="display: none;" /></a>`;
            const resultImg = document.querySelector("#resultContainer img");
            resultImg.style.display = 'block'; // This is a simplified fadeIn. For a fade effect, you'd need a bit more logic or CSS transitions.
            window.scrollTo({ 
            top: document.querySelector("#actionBar").offsetTop, 
            behavior: 'smooth' 
            });
            document.querySelector("#saveButton").disabled = false;
        })
        .catch(error => {
            let errorMessage = 'There was an issue capturing the screenshot.';
            if (error && error.response && error.response.data && error.response.data.message) {
                errorMessage = error.response.data.message;
            }
            document.querySelector("#errorContainer").innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show mb-3 mt-15" role="alert">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-exclamation-triangle me-2 pb-2"></i>
                        <h4>Server Error</h4>
                    </div>
                    <p>
                        ${errorMessage}
                    </p>
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>
            `;
        })
        .finally(() => {
            document.querySelector("#screenshotSpinner").style.display = 'none';
            document.querySelector("#submitButton").disabled = false;
        });

    });

    function displayErrorMessage(message) {
        const errorContainer = document.querySelector("#errorContainer");
        errorContainer.innerHTML = `
            <div class="alert alert-danger alert-dismissible fade show mb-3 mt-15" role="alert">
                <div class="d-flex align-items-center">
                    <i class="fas fa-exclamation-triangle me-2 pb-2"></i>
                    <h4>Application Error</h4>
                </div>
                <p>
                    ${message}
                </p>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        errorContainer.style.display = 'block';
    }

    // Function to handle the settings save
    document.querySelector("#apiSettingsModal .btn-primary").addEventListener("click", function(e) {
        const apiUrl = document.querySelector("#apiUrl").value;
        const apiKey = document.querySelector("#apiKey").value;

        if (document.querySelector("#saveSettingsCheckbox").checked) {
            localStorage.setItem("apiUrl", apiUrl);
            localStorage.setItem("apiKey", apiKey);
        } else {
            sessionStorage.setItem("apiUrl", apiUrl);
            sessionStorage.setItem("apiKey", apiKey);
        }
    });
});
