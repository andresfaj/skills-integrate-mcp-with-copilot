document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const searchInput = document.getElementById("activity-search");
  const categoryFilter = document.getElementById("category-filter");
  const sortSelect = document.getElementById("activity-sort");
  const activityCount = document.getElementById("activity-count");
  let allActivities = {};

  function updateCategoryOptions(activities) {
    const selectedCategory = categoryFilter.value;
    const categories = [...new Set(
      Object.values(activities)
        .map((details) => details.category)
        .filter(Boolean)
    )].sort((first, second) => first.localeCompare(second));

    categoryFilter.replaceChildren(new Option("All categories", ""));
    categories.forEach((category) => {
      categoryFilter.add(new Option(category, category));
    });
    categoryFilter.value = categories.includes(selectedCategory) ? selectedCategory : "";
  }

  function updateActivityOptions(activities) {
    const selectedActivity = activitySelect.value;
    activitySelect.replaceChildren(new Option("-- Select an activity --", ""));

    Object.keys(activities).forEach((name) => {
      activitySelect.add(new Option(name, name));
    });

    if (activities[selectedActivity]) {
      activitySelect.value = selectedActivity;
    }
  }

  function getStartTime(schedule) {
    const match = schedule.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return Number.POSITIVE_INFINITY;

    const hour = Number(match[1]) % 12;
    const minute = Number(match[2]);
    const afternoonOffset = match[3].toUpperCase() === "PM" ? 12 : 0;
    return (hour + afternoonOffset) * 60 + minute;
  }

  function renderActivities() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    const selectedCategory = categoryFilter.value;
    const filteredActivities = Object.entries(allActivities).filter(([name, details]) => {
      const matchesCategory = !selectedCategory || details.category === selectedCategory;
      const searchableText = [name, details.description, details.schedule, details.category]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();

      return matchesCategory && searchableText.includes(query);
    });

    if (sortSelect.value === "time") {
      filteredActivities.sort(([firstName, firstDetails], [secondName, secondDetails]) =>
        getStartTime(firstDetails.schedule) - getStartTime(secondDetails.schedule) ||
        firstName.localeCompare(secondName)
      );
    } else {
      filteredActivities.sort(([firstName], [secondName]) => firstName.localeCompare(secondName));
    }

    activitiesList.replaceChildren();
    activityCount.textContent = `Showing ${filteredActivities.length} of ${Object.keys(allActivities).length} activities`;

    if (filteredActivities.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "empty-state";
      emptyMessage.textContent = "No activities match these filters.";
      activitiesList.appendChild(emptyMessage);
      return;
    }

    filteredActivities.forEach(([name, details]) => {
      const activityCard = document.createElement("div");
      activityCard.className = "activity-card";

      const spotsLeft = details.max_participants - details.participants.length;
      const participantsHTML = details.participants.length > 0
        ? `<div class="participants-section">
            <h5>Participants:</h5>
            <ul class="participants-list">
              ${details.participants
                .map((email) => `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`)
                .join("")}
            </ul>
          </div>`
        : "<p><em>No participants yet</em></p>";

      activityCard.innerHTML = `
        <h4>${name}</h4>
        <p class="activity-category">${details.category || "Uncategorized"}</p>
        <p>${details.description}</p>
        <p><strong>Schedule:</strong> ${details.schedule}</p>
        <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
        <div class="participants-container">${participantsHTML}</div>
      `;
      activitiesList.appendChild(activityCard);
    });

    document.querySelectorAll(".delete-btn").forEach((button) => {
      button.addEventListener("click", handleUnregister);
    });
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      allActivities = await response.json();
      updateCategoryOptions(allActivities);
      updateActivityOptions(allActivities);
      renderActivities();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }

    searchInput.addEventListener("input", renderActivities);
    categoryFilter.addEventListener("change", renderActivities);
    sortSelect.addEventListener("change", renderActivities);
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
