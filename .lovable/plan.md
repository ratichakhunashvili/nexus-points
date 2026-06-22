## Plan

1. **Fix the camera startup flow**
   - Change the scanner so the camera request happens immediately from the **Start camera** button click.
   - Avoid async camera probing before the camera starts, because mobile browsers can treat that as losing the user gesture and fail with “page didn’t load” / retry behavior.

2. **Make the scanner more reliable on phones**
   - Start with the back camera when available.
   - If the back-camera constraint fails, fall back to any available camera.
   - Keep cleanup safe so a failed attempt does not leave the scanner stuck.

3. **Improve student-facing guidance**
   - Show a clear message if the app is opened inside a preview/iframe, because browser camera access often requires opening the app in a new tab or using the published link.
   - Keep the manual code entry available as a fallback, but the primary flow will be camera scanning.

4. **Verify behavior**
   - Check the scan page after changes for runtime errors.
   - Confirm the Start camera button no longer triggers navigation to home/retry and that errors are shown inline/toast instead.