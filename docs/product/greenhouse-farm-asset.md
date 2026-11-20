# Greenhouse and Protected-Cropping Assets in Farm Profiles

## Product decision

SARINA records whether a farm contains a greenhouse or another protected-cropping structure as part of the farm's infrastructure inventory. This is a lightweight asset record, not an automatic specialist-consultation workflow.

## MVP fields

Each structure is recorded separately:
- farmer-provided name or identifier;
- operating status: unknown, active, seasonal, under construction, or inactive;
- structure type: plastic, glass, polycarbonate, tunnel/small structure, shade-net structure, other, or unknown;
- growing system: soil, substrate, hydroponic, aquaponic, mixed, or unknown;
- purpose: crop production, seedling propagation, research/trial, multiple purposes, or unknown;
- approximate area in square metres (optional);
- current crop or use (optional free text).

This intentionally includes small structures used only to raise seedlings for planting between orchard trees. Recording them now avoids a later schema or workflow redesign.

## Data handling

The current MVP stores the farmer-reported asset as a versioned SARINA_GREENHOUSE_ASSET_V1 payload in farm_observations, using observation_type = greenhouse_asset. The record is explicitly marked self-reported and unverified. It does not assert that a greenhouse is low-risk or that its growing system is suitable.

## Analysis policy

No greenhouse-specific expert analysis is triggered merely because a greenhouse exists. Specialist analysis is on demand, or can be initiated later when a farmer reports a problem, requests advice, or another SARINA workflow identifies a relevant risk. Soil, substrate, hydroponic and aquaponic systems remain distinguishable for future analysis.

## Scope boundary

The MVP does not yet include greenhouse climate sensors, fertigation recipes, crop-cycle management, structural engineering, disease diagnostics, or automatic greenhouse risk scoring. Those can be added as separate capabilities when validated user demand justifies them.
