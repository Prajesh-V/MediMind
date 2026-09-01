# AI architecture

## Allowed roles

Gemini may extract prescription/food candidates, interpret user intent, call typed backend tools, summarize authorized verified data, translate, and explain verified results in plain language.

## Prohibited roles

Gemini must not independently determine a drug-food interaction, evidence, severity, contraindication, dose, medication change, diagnosis, treatment plan, or causality.

## Future tool protocol

The server provides narrow tools such as `get_current_medications`, `get_recent_doses`, `get_food_history`, `get_relevant_doses`, `check_interactions`, and `get_evidence`. The server validates arguments and authorization before execution, then gives Gemini only the verified result required for the response.

M0 defines contracts only. It does not configure a Gemini client, invoke a model, or expose chat functionality.
