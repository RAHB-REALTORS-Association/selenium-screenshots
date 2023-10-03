$(document).ready(function() {
    
    // Load the API settings from local storage if they exist
    const storedApiUrl = localStorage.getItem("apiUrl");
    const storedApiKey = localStorage.getItem("apiKey");

    if (storedApiUrl) {
        $("#apiUrl").val(storedApiUrl);
    }

    if (storedApiKey) {
        $("#apiKey").val(storedApiKey);
    }

    // Function to trigger the download of the image
    $("#saveButton").click(function(e) {
        e.preventDefault();
        $("#saveSpinner").show();  // Show the spinner
        
        let imageUrl = $("#resultContainer img").attr('src');
        let link = document.createElement('a');
        link.href = imageUrl;
        link.download = 'screenshot.png';  // You can customize the filename here
        link.click();
        
        $("#saveSpinner").hide();  // Hide the spinner
    });

    // Function to handle the screenshot request
    $("#submitButton").click(function(e) {
        e.preventDefault();
        $("#screenshotSpinner").show();  // Show the spinner
        $("#submitButton").prop("disabled", true);
        
        // Get input values
        const apiUrl = $("#apiUrl").val();
        const apiKey = $("#apiKey").val();
        const websiteUrl = encodeURIComponent($("#websiteUrl").val());
        const viewport = $("#viewport").val();
        const format = $("#format").val();
        const delay = $("#delay").val();

        // Construct the request URL and headers
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

        // Make the AJAX GET request to the screenshot API
        $.ajax({
            url: requestUrl,
            type: "GET",
            headers: headers,
            xhrFields: {
                responseType: 'blob'
            },
            success: function(blob) {
                const imageUrl = URL.createObjectURL(blob);
                $("#resultContainer").html('<img src="' + imageUrl + '" style="display: none;" />');
                $("#resultContainer img").fadeIn();
            },
            error: function(error) {
                $("#resultContainer").html(`
                    <div class="alert alert-warning mb-3 mt-15" role="alert">
                        <div class="d-flex align-items-center">
                            <i class="fas fa-exclamation-circle me-2 pb-2"></i>
                            <h4>Error Taking Screenshot</h4>
                        </div>
                        <p>
                            There was an issue capturing the screenshot. Please check the provided details and try again.
                        </p>
                    </div>
                `);
            },
            complete: function() {
                $("#screenshotSpinner").hide();  // Hide the spinner
                $("#submitButton").prop("disabled", false);
            }
        });

        // Save the API settings to local storage if checkbox is checked
        if ($("#saveSettingsCheckbox").is(":checked")) {
            localStorage.setItem("apiUrl", apiUrl);
            localStorage.setItem("apiKey", apiKey);
        }
    });
});
