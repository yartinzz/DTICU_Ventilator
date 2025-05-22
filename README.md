# Project Setup and Installation Guide

## 1. Frontend

### Setup
- Install **Toolpad Core** and required **Node.js libraries**.
- Follow the [official Toolpad Core documentation](https://mui.com/toolpad/core/) to correctly configure the framework.

### Project Structure
- The `app/layout.tsx` file defines the root layout. You can customize the navigation bar as needed.
- Pages are located under the `app/(dashboard)/` directory. You may add or modify pages based on your needs.

### Existing Pages
- `glycemia` and `asynchrony` pages currently display static content without any functional features.
- `ventilator/peep`: This page allows PEEP selection, dynamically displays ventilator-related data, and invokes MATLAB modules for real-time prediction.
- `ventilator/ventmode`: This page enables ventilator mode selection, displays real-time ECG, EMG, EEG, and EIG data, and guides ventilator settings using physiological parameters.
- `ECG`: Currently not implemented.
- `sensorpage`: Displays data from custom sensors, segmented by breathing cycles, showing estimated parameters like lung compliance and airway resistance.

### Development
- Update frontend HTTP/WebSocket addresses to match your backend configuration.
- If you're using npm, navigate to the `frontEnd` directory and run:
  ```bash
  npm run dev
  ```
  By default, the frontend will run on `http://localhost:3000`.

---

## 2. Backend

### Setup
- Install all dependencies using:
  ```bash
  pip install -r requirements.txt
  ```
- MATLAB integration depends on `matlab.engine`. Please refer to the [official MATLAB documentation](https://www.mathworks.com/help/matlab/matlab_external/get-started-with-matlab-engine-for-python.html) for setup instructions.

### Module Overview
- **binlog**: Monitors MySQL binlog for database updates. Modify this module to support custom table structures.
- **core**: Manages data cache, subscribers, and real-time parallel data dispatching.
- **database**: Handles all database interactions. Customize SQL queries for your schema.
- **matlab_engine**: Manages a pool of preloaded MATLAB engines for concurrent calls.
- **routers**: Defines API routes. Modify or add new routes for custom functionality.
- **services**: Interfaces with MATLAB functions. Adjust input/output to fit your MATLAB modules.
- **websocket**: Manages WebSocket connections and responds to specific events.
- **config**: Stores environment variables and basic settings.
- **main.py**: Main entry point. By default, the server binds to `http://localhost:8000`.

---

## 3. Database

- This project uses **MySQL**. If you prefer a different database system, adapt the logic in `binlog` and `database` modules accordingly.
- Ensure that MySQL has the necessary permissions and configuration for binlog monitoring.

---

## 4. Device Integration

- You can use any device or simulator to periodically push data to the database for testing purposes.

---

## License

This project is open-sourced under the **MIT License**.
