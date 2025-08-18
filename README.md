# Company Portal PWA

This project contains a simple Progressive Web App (PWA) that you can use to manage your small business activities.  It is built using only HTML, CSS and vanilla JavaScript and stores data locally in your browser using `localStorage` — there is no server or database required.  Because the data is stored in each user's browser, it will not sync automatically between devices.  If you need to access the same data from multiple devices you would need to implement a server or cloud database, which is beyond the scope of this simple example.

## Features

- **Login page:** A basic username/password form.  The application seeds a single user (`admin` / `password`) on first use.  You can edit the `defaultUsers` array in `common.js` to add or change user accounts.  Authentication is entirely client‑side and should not be used for sensitive information.
- **Menu page:** Provides links to the four main functions and a logout button.
- **Boat/Trailer scheduling:** Add, view and delete scheduled moves.  Each entry includes a date, time, description and boat/trailer details.
- **Employee schedule:** Add, view and delete employee shifts.  Records include employee name, date, start/end time and optional notes.
- **Maintenance requests:** Add, view and delete maintenance items.  Each request stores a date, description and priority (Low/Medium/High).
- **Move outs:** Record, view and delete move-out events with occupant name, date and optional notes.
- **Offline support:** The service worker caches all files on the first visit so the app continues to work when there is no internet connection.

## How to use

1. **Unzip the project:** After downloading the ZIP archive, extract its contents to a folder on your computer.  All application files live in that folder.  Do not rename the files unless you also update the references inside the HTML pages.

2. **Open locally (for testing):** You can open `index.html` directly in your browser to test the application.  Most modern browsers will allow you to install it to your home screen or apps menu.  Note that some features (like the service worker) may behave differently when loaded via the `file:///` protocol compared to being served over HTTP.

3. **Host on GitHub Pages:**
   * Create a new repository on your GitHub account (for example, `company‑portal`).
   * Add all files and commit them to the main branch.  If you are unfamiliar with Git, the simplest way is to use GitHub’s web interface to upload the files directly.
   * In the repository settings (⚙️ → **Pages**), choose the branch (e.g. `main`) and the folder (`/` root).  Save the settings and GitHub will deploy your site.
   * Visit the provided URL (something like `https://your‑username.github.io/company‑portal/`) to access the app.  Because GitHub serves your site over HTTPS, the PWA features (installing as an app and caching offline) will work correctly.

4. **Customise users:** To change or add user accounts, edit the `defaultUsers` array in `common.js`.  Each entry requires a `username` and `password` property.  When no users exist in localStorage (first run), these defaults are copied into storage.

5. **Limitations:** This PWA stores all data in the browser’s `localStorage`.  This means:
   * Data is tied to each device/browser — one user’s changes are not shared with others automatically.
   * Clearing the browser cache or running in incognito/private mode may remove your data.
   * For true multi‑user capability or data persistence across devices, you would need to integrate a backend service or database.

If you decide later that you need a more robust solution (for example, storing data in the cloud so multiple employees see the same schedules), you could look into free tiers of backend services like Firebase or Supabase.  Those services would require additional setup and code changes.

## PWA icon and manifest

The `icons` folder contains multiple sizes of the application icon used by the manifest file (`manifest.json`).  These icons were generated from a simple abstract design representing scheduling and boating.  The manifest specifies the start URL, colours and display behaviour for installed versions of the app.

## Further reading

To learn more about Progressive Web Apps and deploying static sites, check out the following resources:

- [MDN Web Docs – Progressive web apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [GitHub Pages documentation](https://docs.github.com/en/pages)
- [Using the Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache) and [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) on MDN

Feel free to explore the code and extend it to suit your business needs.  This project is intentionally kept straightforward to make it easy to understand and adapt.