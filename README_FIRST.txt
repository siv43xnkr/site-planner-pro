STACK N STOCK SITE PLANNER - LOCAL PATCH
=======================================

WHAT THIS PATCH DOES
--------------------
1. Finishes the wiring Lovable stopped before completing.
2. Makes PLACE TEMPLATE trigger the H1 S1 R1 true-scale template already present in MapWorkspace.tsx.
3. Makes FLIP LAYOUT work.
4. Updates the right-side status when the template is placed.
5. Lets local development use your own Google Maps API key through VITE_GOOGLE_MAPS_API_KEY.
6. Keeps Lovable compatibility as a fallback.

THE H1 S1 R1 GEOMETRY ALREADY IN THE REPOSITORY
-----------------------------------------------
Overall: 9.94 m x 15.80 m = 157.052 m2 = about 3.88 cents
b: 2.50 m x 14.00 m
A: 2.44 m x 14.00 m
B: 5.00 m x 14.00 m
Rear bike-only connection: 9.94 m x 1.80 m
X: 4.00 m x 4.00 m inside B near the rear
Generator: 3.00 m x 1.10 m inside B near X
No C zone

HOW TO APPLY
------------
A. Clone/download your GitHub repository to your Windows PC.
B. Extract this patch ZIP directly into the repository folder.
C. When Windows asks whether to replace files, choose Replace.

LOCAL MAP KEY
-------------
The Lovable-managed Google Maps browser key may be restricted to Lovable domains.
For localhost, use your own Google Maps browser API key.

1. Copy .env.local.example and rename the copy to .env.local
2. Open .env.local in Notepad
3. Replace YOUR_GOOGLE_MAPS_BROWSER_KEY_HERE with your own key
4. Save the file

RUN LOCALLY
-----------
Open PowerShell in the repository folder and run:

npm install
npm run dev

Then open the localhost address shown by Vite, normally something like:
http://localhost:5173

TEST
----
1. Search a location.
2. Draw a parcel.
3. Confirm m2/cents update.
4. Click PLACE TEMPLATE.
5. Zoom in if needed: the template is only 9.94 m x 15.80 m in the real world.
6. Drag the white centre handle to move the whole template.
7. Drag the cyan rotation handle to rotate it.
8. Click FLIP LAYOUT to swap b | A | B into B | A | b.

IMPORTANT
---------
This patch does NOT yet implement green/red parcel containment PASS/FAIL. That is the next stage after template placement is confirmed locally.
