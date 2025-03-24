# DTICU Ventilator

## Disclaimer
This is the first version of the project. Many parts are incomplete, and significant adjustments are needed for proper installation and testing.

## Overview
The DTICU Ventilator project is designed for advanced medical applications. At this stage, it serves as a prototype that integrates a custom backend with MATLAB interfaces and a front-end built on Toolpad Core. Installation and testing require manual configuration and port mapping adjustments since the software is tested on a virtual machine.

## Installation & Setup

### 1. Frontend: Install Toolpad Core and Necessary Node.js Libraries
- Use Toolpad Core as the frontend framework.
- Install all the required Node.js libraries. Make sure to follow the official documentation for Toolpad Core to set up the framework properly.
- Verify that all dependencies are installed.

### 2. Port Configuration
- Adjust the ports used by the frontend and backend services.
- Since the software is tested on a virtual machine, ensure that the port mapping is correctly configured.

### 3. Configure the .env File
- Create and configure your environment variables using a `.env` file.

### 4. Database and Interface Adjustments
- Configure your database to match the specific requirements of your project. This includes setting up the necessary tables and schema.
- Adjust the backend interfaces so that they correctly interact with your database.
- Modify the MATLAB interface to work with your project’s data and processing needs.

## Notes
- **First Version**: This version is experimental. Future iterations will address many of the current limitations.
- **Testing**: Extensive testing in the virtual machine environment is required. Pay special attention to port mappings and network configurations.

## License
This project is released under the MIT License.
