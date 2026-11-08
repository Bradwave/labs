# Hand tracking with the camera — plan

Use the device camera to move the cart and to draw on the graphs with the hand. It works in both free exploration and activities, entirely in the browser, with no extra hardware.

## Why

With a mouse or a finger, the motion is a few centimetres. With the hand in front of a camera, the motion is the whole arm, visible to a group around one laptop. The same "move to make the graph" tasks become embodied. Whole-body tracking would bring back "walk the graph" without a motion sensor.

## How it works

- **Tracker:** MediaPipe Hand Landmarker (Google, Apache 2.0). It runs locally (WebAssembly, GPU when available) at about 30 frames per second and finds 21 points per hand.
- **Cart:** the horizontal position of the hand (the base of the index finger, or the centre of the palm) moves the cart. The image is mirrored, so moving right moves the cart right.
- **Grab and release:** a pinch (thumb and index finger together) grabs the cart; opening the fingers releases it.
- **Drawing:** a pinch puts the pen down on the active graph; the index fingertip draws.
- **Recording:** the button or R key, as today. An optional gesture, such as an open palm held for half a second, toggles recording without touching the device.
- **Smoothing:** a light filter on the landmarks, then the existing smoothing of recordings.

## Calibration

The camera doesn't measure metres. Two calibration points fix the scale: hold the hand at two marks a known distance apart (the ends of a ruler, tape on the desk) and enter the distance. Without calibration, the shape is right but the values are not. The calibration is stored per device.

## Design in the code

- **One input layer.** Mouse, touch and hand all produce the same pointer-like events (down, move, up, with a position), so dragging the cart, drawing, picking, the challenge and every activity step work unchanged. Nothing is duplicated between free exploration and activities.
- **Camera module.** `js/hand.js` handles permission, the stream, the tracker, gestures and calibration. It is loaded only when the camera is switched on.
- **Interface:**
  - a camera button in the toolbar and on the activity screen;
  - a small mirrored preview with the tracked points, so students see what is being tracked;
  - a calibration dialog.

## Files and offline use

The tracking engine and model (about 10–15 MB) are bundled with the app and loaded on demand, so the app stays fast for everyone else, works offline, and nothing is fetched from third parties.

## Privacy

- Camera permission is asked only when the feature is switched on.
- Frames are processed on the device and never stored or sent.
- The preview shows clearly when the camera is on.
- Some schools have rules on cameras with students; the help text says how it works, so teachers can decide.

## Limits

- **Frame rate and lag:** about 30 frames per second and about 0.1 s of lag. Position and velocity are fine with smoothing; acceleration is noisy, which is a good discussion point.
- **Lighting and background** affect tracking.
- **Older phones** may be too slow; laptops and recent tablets are the target.

## Stages

1. Camera toggle, mirrored preview, two-point calibration.
2. Hand to cart with pinch to grab: in Drag mode, Challenge, and activity move steps.
3. Drawing on graphs with a pinch (free exploration drawing, activity draw steps, predictions).
4. Whole-body tracking (MediaPipe Pose) to walk the graph in front of a laptop or projector camera.
