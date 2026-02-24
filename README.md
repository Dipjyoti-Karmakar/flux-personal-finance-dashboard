# 💰 Flux — Personal Finance Dashboard

![HTML5](https://img.shields.io/badge/HTML5-Frontend-orange?style=for-the-badge&logo=html5)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-yellow?style=for-the-badge&logo=javascript)
![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth-ffca28?style=for-the-badge&logo=firebase)
![Status](https://img.shields.io/badge/Status-Completed-success?style=for-the-badge)

## 📄 Project Overview
Flux is a modern personal finance dashboard built using **HTML, CSS, and vanilla JavaScript**, with secure cloud integration through **Firebase Authentication and Firestore**. The application enables users to track income and expenses, import financial records, and analyze spending patterns through an interactive dashboard.

The project demonstrates the development of a **cloud-integrated, data-driven web application** with real-time synchronization, structured transaction management, and financial analytics visualization.

## 🎯 Objectives
* **Transaction Tracking:** Record, edit, and manage income and expense transactions efficiently.
* **Financial Analytics:** Provide real-time insights into balance, spending trends, and category distribution.
* **Cloud Integration:** Implement secure authentication and cloud storage using Firebase.
* **Data Import:** Support Excel and CSV import for bulk financial data management.
* **Responsive Dashboard:** Deliver a modern, mobile-friendly user interface.

## 🗂️ Data Structure
The application stores user transactions in a structured cloud database:

* **Collection:** `users/{uid}/transactions`
* **Fields include:**
  * Transaction type (income / expense)
  * Payment mode (online / offline)
  * Description
  * Category
  * Amount
  * Date
  * Import indicator (optional)

## 🛠️ Tech Stack
* **Frontend:** HTML, CSS, JavaScript
* **Cloud Services:**
  * Firebase Authentication
  * Firebase Firestore Database
* **Libraries:**
  * SheetJS (xlsx) for Excel and CSV import
* **Tools:**
  * VS Code
  * Git
  * Web Browser

## 📊 Key Features
The application provides the following capabilities:

1. **Transaction Management**
   * Add, edit, and delete financial transactions
   * Categorize income and expenses
   * Track online and offline payments

2. **Financial Dashboard**
   * Net balance overview
   * Total income and expense tracking
   * Spending trends and breakdown
   * Category-wise analysis

3. **Data Import and Export**
   * Import Excel and CSV files
   * Automatic column mapping and validation
   * Export transaction history to CSV

4. **Cloud Sync**
   * Secure login using Google Authentication
   * Real-time synchronization across devices

5. **User Experience**
   * Responsive design
   * Dark and light mode
   * Interactive dashboard interface

## 🚀 How to Run
1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/flux-personal-finance.git
   ```

2. **Open the Project**
   Open the `index.html` file in your browser

   OR run a local server:

   ```bash
   python -m http.server 8000
   ```

3. **Open in Browser**
   ```
   http://localhost:8000
   ```

4. **Optional: Configure Firebase**
   Replace the Firebase configuration in the script with your project credentials.

## 👤 Author
**Dipjyoti Karmakar**  
* **Role:** Data Analyst / Frontend Developer / Business Intelligence  
* **Connect with me:** [LinkedIn Profile](https://www.linkedin.com/in/dipjyoti-karmakar-91050a37a)

---

*This project is part of my portfolio demonstrating skills in JavaScript application development, cloud database integration, and financial analytics dashboard design.*