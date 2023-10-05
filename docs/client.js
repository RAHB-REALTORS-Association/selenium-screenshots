$(document).ready(function () {
  // Event listeners for the collapsible div
  $("#settingsContent").on("show.bs.collapse", function () {
    $("#toggleIcon").removeClass("fa-chevron-down").addClass("fa-chevron-up");
  });

  $("#settingsContent").on("hide.bs.collapse", function () {
    $("#toggleIcon").removeClass("fa-chevron-up").addClass("fa-chevron-down");
  });

  // Load the API settings from either local storage or session storage
  const storedApiUrl =
    localStorage.getItem("apiUrl") || sessionStorage.getItem("apiUrl");
  const storedApiKey =
    localStorage.getItem("apiKey") || sessionStorage.getItem("apiKey");

  if (storedApiUrl) {
    $("#apiUrl").val(storedApiUrl);
  }

  if (storedApiKey) {
    $("#apiKey").val(storedApiKey);
  }

  // Check if settings are absent in both local and session storage
  if (!storedApiUrl || !storedApiKey) {
    $("#apiSettingsModal").modal("show");
  }

  // Initially disable the saveButton
  $("#saveButton").prop("disabled", true);

  // Function to trigger the download of the image
  $("#saveButton").click(function (e) {
    e.preventDefault();
    $("#saveSpinner").show(); // Show the spinner

    let imageUrl = $("#resultContainer img").attr("src");
    let link = document.createElement("a");
    link.href = imageUrl;
    link.download = "screenshot.png";
    link.click();

    $("#saveSpinner").hide(); // Hide the spinner
  });

  // Function to handle the screenshot request
  $("#submitButton").click(function (e) {
    e.preventDefault();

    // Collapse the settings div if it's open
    $("#settingsContent").collapse("hide");

    // Disable the saveButton until the new screenshot is loaded
    $("#saveButton").prop("disabled", true);

    $("#screenshotSpinner").show(); // Show the spinner
    $("#submitButton").prop("disabled", true);

    // Get input values
    const apiUrl = $("#apiUrl").val();
    const apiKey = $("#apiKey").val();
    const websiteUrl = encodeURIComponent($("#websiteUrl").val());
    const viewport = $("#viewport").val();
    const format = $("#format").val();
    const delay = $("#delay").val();

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
      Authorization: `Bearer ${apiKey}`,
    };

    // AJAX call to the screenshot API
    $.ajax({
      url: requestUrl,
      type: "GET",
      headers: headers,
      xhrFields: {
        responseType: "blob",
      },
      success: function (blob) {
        const imageUrl = URL.createObjectURL(blob);
        $("#resultContainer").html(
          '<a href="' +
            imageUrl +
            '" target="_blank" rel="noopener noreferrer"><img src="' +
            imageUrl +
            '" style="display: none;" /></a>',
        );

        // This animation smoothly scrolls to the result container and then fades in the image once the screenshot has been loaded.
        // Smoothly scroll to the result container and fade in the image
        $("html, body").animate(
          {
            scrollTop: $("#resultContainer").offset().top,
          },
          1000,
          function () {
            // Animation complete, now fade in the image
            $("#resultContainer img").fadeIn();
          },
        );

        // Enable the saveButton as the screenshot has loaded
        $("#saveButton").prop("disabled", false);
      },
      error: function (error) {
        let errorMessage = "There was an issue capturing the screenshot.";

        // Check if the error response has a message and use it
        if (error && error.responseJSON && error.responseJSON.message) {
          errorMessage = error.responseJSON.message;
        }

        $("#errorContainer").html(`
                    <div class="alert alert-danger mb-3 mt-15" role="alert">
                        <div class="d-flex align-items-center">
                            <i class="fas fa-exclamation-triangle me-2 pb-2"></i>
                            <h4>Error</h4>
                        </div>
                        <p>
                            ${errorMessage}
                        </p>
                    </div>
                `);
      },
      complete: function () {
        $("#screenshotSpinner").hide(); // Hide the spinner
        $("#submitButton").prop("disabled", false);
      },
    });
  });

  // Function to handle the settings save
  $("#apiSettingsModal .btn-primary").click(function (e) {
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
