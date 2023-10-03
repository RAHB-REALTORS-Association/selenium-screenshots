$("#submitButton").click(function(e) {
    e.preventDefault();
    
    // Get input values
    const apiUrl = $("#apiUrl").val();
    const apiKey = $("#apiKey").val();
    const websiteUrl = encodeURIComponent($("#websiteUrl").val());
    const viewport = $("#viewport").val();
    const format = $("#format").val();
    const delay = $("#delay").val();

    // Construct the request URL and headers
    const requestUrl = `${apiUrl}/screenshot?url=${websiteUrl}&viewport=${viewport}&format=${format}&delay=${delay}`;
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
            $("#resultContainer").html('<span style="color: red;">Error taking screenshot.</span>');
        },
        complete: function() {
            // Handle spinner and button state after request completion
            // (assuming you have a spinner element with ID "spinner")
            $("#spinner").hide();
            $("#submitButton").prop("disabled", false);
        }
    });

    // Save the API settings to local storage if checkbox is checked
    if ($("#saveSettingsCheckbox").is(":checked")) {
        localStorage.setItem("apiUrl", apiUrl);
        localStorage.setItem("apiKey", apiKey);
    }
});
