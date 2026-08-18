# Site Planner Pro

Build a professional web application called “Stack n Stock Site Suitability Dashboard”.

This is a site-planning tool that will eventually allow users to draw land parcels on a satellite map and test whether Stack n Stock ASRS pod configurations fit on the land.

For this first step, build only the dashboard user interface and page structure. Do not add Google Maps API integration, parcel drawing logic, geometry calculations, or fake suitability calculations yet.

Overall layout

Create a full-screen desktop dashboard with three main sections:

1. Left Sidebar — SNS Configuration

Width around 280–320 px.

At the top show:

Stack n Stock
Site Suitability Dashboard

Add a configuration section containing:

Height

H1

H2

H3

Series

S1

S2

Parallel

R1

R2

For now, default selection should be:

H1 S1 R1

Below this show a card titled:

Selected Configuration

Display:

H1 S1 R1

Template Dimensions

Width: 9.94 m

Depth: 15.80 m

Footprint: 157.05 m²

Approx. Land: 3.88 cents

Then show a simple legend for the site-template zones:

b — Bike Dispatch Side: 2.50 m

A — Pod / Container

B — Main Operations: 5.00 m

Rear Bike Connection: 1.80 m

X — Utility Area

Generator: 3.0 m × 1.1 m

Add buttons:

Place Template
Flip Layout

These buttons do not need to function yet.

2. Main Centre Area — Map Workspace

This should occupy most of the screen.

Create a large map-style placeholder panel.

At the top of the workspace include:

Location search bar

Satellite button

Draw Parcel button

Clear Parcel button

Mark Road button

These controls are visual only for now.

Inside the map placeholder, display subtle text:

Satellite Map Workspace

and underneath:

Google satellite map integration will be added in the next step.

Add floating map-tool buttons on the right side for:

Zoom +

Zoom −

Rotate

Reset View

Do not create a fake satellite image.

3. Right Sidebar — Site Suitability

Width around 300–340 px.

At the top show:

Site Suitability

Create status rows for:

Parcel Area

Physical Template Fit

Bike Circulation

Utility Area X

Generator Placement

B Operational Area

Bada Dost Access

Road / Gate Verification

Since no parcel has been drawn yet, every status should display:

Not Evaluated

At the bottom add a large overall status card:

Overall Result

WAITING FOR SITE INPUT

Below it display:

Draw a land parcel and place an SNS template to begin evaluation.

Visual design

Use a modern professional industrial/logistics dashboard style.

Prefer:

dark charcoal/navy background

clean cards

strong typography

subtle borders

compact spacing

green for pass

amber for conditional

red for failure

neutral grey for not evaluated

Do not make it look playful or like a generic SaaS landing page.

This is an engineering and site-planning application.

The central map workspace should be visually dominant.

Important rules

Do not invent land data.

Do not show fake parcel measurements.

Do not show fake Google satellite imagery.

Do not calculate suitability yet.

Do not integrate Google Maps yet.

Do not build login/authentication yet.

Do not add database functionality yet.

Do not add extra pages.

Keep this as a single-screen working dashboard shell.

Make the page responsive, but optimize primarily for desktop/laptop use.

After completing the UI, ensure there are no obvious layout overflows or overlapping panels.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d1991a91-db49-4ce5-9843-e083ba7f951a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
