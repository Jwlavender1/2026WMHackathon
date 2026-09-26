# Turnout AI feature plan

**Status: saved for later; not implemented.** The team is focusing on UI changes first. Google AI Studio / the Gemini API is the likely provider, pending the team's final choice and API credentials.

## Recommended first feature

Add **Draft with AI** to Create event. Organizers can describe an opportunity or paste an announcement/email. AI returns an editable draft with a title, description, suggested volunteer tasks, and supplies. Extract dates, location, capacity, and recurrence only when supplied; flag missing details for the organizer to complete.

The organizer reviews and edits the draft before publishing through the existing form. Generated suggestions do not automatically create events or send messages. Pasted announcements do not require connecting an inbox.

## Integration direction

- Call Gemini from a Next.js server endpoint with a server-only API key.
- Use structured output and Zod validation; retain existing event validation and permissions.
- Start with public event text and fictional demo inputs. Review the selected Google plan's data handling before sending private information.
- Add request limits, a timeout, and a usable manual form when generation fails.
- Develop locally while DigitalOcean provisioning is pending. Production secrets will be configured by the deployment owner.
- No vector database or separate AI service is needed for this initial scope.

## Possible follow-ups

Natural-language discovery is the next candidate: interpret volunteer preferences into filters and explain matches among real events. Other possibilities are event-specific questions, authorized conversation summaries with source links, and organization impact recaps using application-calculated attendance and hours.

References: [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output), [API keys](https://ai.google.dev/gemini-api/docs/api-key), [pricing and data handling](https://ai.google.dev/gemini-api/docs/pricing).
