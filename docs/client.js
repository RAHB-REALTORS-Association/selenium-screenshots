$(document).ready(function() {

    // Event listener for the delay slider input
    const delaySlider = $("#delaySlider");
    const delayValue = $("#delayValue");

    delaySlider.on('input', function() {
        delayValue.text(delaySlider.val());
    });

    // Format button behavior
    $("#formatBtnGroup button").click(function() {
        // Set all buttons to secondary color
        $("#formatBtnGroup button").removeClass("btn-primary").addClass("btn-secondary");
        
        // Set the clicked button to primary color
        $(this).removeClass("btn-secondary").addClass("btn-primary");

        // Update the format value based on the clicked button
        $("#format").val($(this).data("format"));
    });

    // Event listeners for the collapsible div
    $('#settingsContent').on('show.bs.collapse', function() {
        $("#toggleIcon").removeClass('fa-chevron-down').addClass('fa-chevron-up');
    });

    $('#settingsContent').on('hide.bs.collapse', function() {
        $("#toggleIcon").removeClass('fa-chevron-up').addClass('fa-chevron-down');
    });

    // Load the API settings from either local storage or session storage
    const storedApiUrl = localStorage.getItem("apiUrl") || sessionStorage.getItem("apiUrl");
    const storedApiKey = localStorage.getItem("apiKey") || sessionStorage.getItem("apiKey");

    if (storedApiUrl) {
        $("#apiUrl").val(storedApiUrl);
    }

    if (storedApiKey) {
        $("#apiKey").val(storedApiKey);
    }

    // Check if settings are absent in both local and session storage
    if (!storedApiUrl) {
        $('#apiSettingsModal').modal('show');
    }

    // Initially disable the saveButton
    $("#saveButton").prop("disabled", true);

    // Function to trigger the download of the image
    $("#saveButton").click(function(e) {
        e.preventDefault();

        // Get the format and image URL
        const format = $("#formatBtnGroup .btn-primary").data("format") || "png";
        let imageUrl = $("#resultContainer img").attr('src');
        let link = document.createElement('a');
        link.href = imageUrl;

        // Generate a timestamp in the format YYYYMMDD-HHMMSS
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 10).replace(/-/g, '') + '-' + now.toISOString().slice(11, 19).replace(/:/g, '');

        link.download = `screenshot-${timestamp}.${format}`;
        link.click();
    });    

    // Function to handle the screenshot request
    $("#submitButton").click(function(e) {
        e.preventDefault();

        // Collapse the settings div if it's open
        $('#settingsContent').collapse('hide');

        // Disable the saveButton until the new screenshot is loaded
        $("#saveButton").prop("disabled", true);

        $("#screenshotSpinner").show();  // Show the spinner
        $("#submitButton").prop("disabled", true);
        
        // Get input values
        const apiUrl = $("#apiUrl").val();
        const apiKey = $("#apiKey").val();
        const websiteUrl = encodeURIComponent($("#websiteUrl").val());
        const viewport = $("#viewport").val() || "1280x960";
        const format = $("#formatBtnGroup .btn-primary").data("format") || "png";
        const delay = $("#delaySlider").val() || "1";  // Use the slider value

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

        // AJAX call to the screenshot API
        $.ajax({
            url: requestUrl,
            type: "GET",
            headers: headers,
            xhrFields: {
                responseType: 'blob'
            },
            success: function(blob) {
                const imageUrl = URL.createObjectURL(blob);

                // Fade out the error message (if present) when the screenshot button is pressed
                $("#errorContainer").fadeOut();

                // Set the image URL as the source of the image tag
                $("#resultContainer").html('<a href="' + imageUrl + '" target="_blank" rel="noopener noreferrer"><img src="' + imageUrl + '" style="display: none;" /></a>');
                
                // First, fade in the image
                $("#resultContainer img").fadeIn(1000, function() {
                    // After the image has faded in, smoothly scroll to its position
                    $('html, body').animate({
                        scrollTop: $("#actionBar").offset().top
                    }, 1000);
                });

                // Enable the saveButton as the screenshot has loaded
                $("#saveButton").prop("disabled", false);
            },
            error: function(error) {
                let errorMessage = 'There was an issue capturing the screenshot.';
                
                // Check if the error response has a message and use it
                if (error && error.responseJSON && error.responseJSON.message) {
                    errorMessage = error.responseJSON.message;
                }
                
                $("#errorContainer").html(`
                    <div class="alert alert-danger alert-dismissible fade show mb-3 mt-15" role="alert">
                        <div class="d-flex align-items-center">
                            <i class="fas fa-exclamation-triangle me-2 pb-2"></i>
                            <h4>Application Error</h4>
                        </div>
                        <p>
                            ${errorMessage}
                        </p>
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
                `);
            },
            complete: function() {
                $("#screenshotSpinner").hide();  // Hide the spinner
                $("#submitButton").prop("disabled", false);
            }
        });
    });

    // Function to handle the settings save
    $("#apiSettingsModal .btn-primary").click(function(e) {
        const apiUrl = $("#apiUrl").val();
        const apiKey = $("#apiKey").val();

        // Save the API settings to local storage or session storage
        if ($("#saveSettingsCheckbox").is(":checked")) {
            localStorage.setItem("apiUrl", apiUrl);
            localStorage.setItem("apiKey", apiKey);
        } else {
            sessionStorage.setItem("apiUrl", apiUrl);
            sessionStorage.setItem("apiKey", apiKey);
        }
    });
});
