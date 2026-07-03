-- MySQL dump 10.13  Distrib 8.4.7, for macos15 (arm64)
--
-- Host: localhost    Database: vendor_portal
-- ------------------------------------------------------
-- Server version	8.4.7

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `action_rules`
--

DROP TABLE IF EXISTS `action_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `action_rules` (
  `id` varchar(36) NOT NULL,
  `rule_name` varchar(150) NOT NULL,
  `trigger_event` varchar(60) NOT NULL,
  `conditions` json DEFAULT NULL,
  `recommended_action` varchar(150) NOT NULL,
  `action_payload` json DEFAULT NULL,
  `priority` int NOT NULL DEFAULT '100',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_action_rules_trigger` (`trigger_event`,`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `action_rules`
--

LOCK TABLES `action_rules` WRITE;
/*!40000 ALTER TABLE `action_rules` DISABLE KEYS */;
INSERT INTO `action_rules` VALUES ('40b26616-22bb-4a90-a235-f9346f4e8e2b','Flag high value for finance review','PR_APPROVED','[{\"field\": \"total_value\", \"value\": 500000, \"operator\": \">\"}]','flag_for_finance_review','{\"message\": \"Exceeds 5,00,000 — Finance review recommended.\"}',10,1,'2026-06-28 16:07:59'),('a4726f26-2c0f-47c5-a510-22c077e1ac09','Suggest RFQ for unapproved vendors','PR_SUBMITTED','[{\"field\": \"preferred_vendor_approved\", \"value\": false, \"operator\": \"==\"}]','suggest_rfq','{\"message\": \"Preferred vendor not approved — RFQ recommended.\"}',10,1,'2026-06-28 16:07:59');
/*!40000 ALTER TABLE `action_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asn_line_items`
--

DROP TABLE IF EXISTS `asn_line_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asn_line_items` (
  `id` varchar(36) NOT NULL,
  `asn_id` varchar(36) NOT NULL,
  `po_line_id` varchar(36) NOT NULL,
  `line_number` int NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `asn_id` (`asn_id`),
  KEY `po_line_id` (`po_line_id`),
  CONSTRAINT `asn_line_items_ibfk_1` FOREIGN KEY (`asn_id`) REFERENCES `asns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `asn_line_items_ibfk_2` FOREIGN KEY (`po_line_id`) REFERENCES `po_line_items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asn_line_items`
--

LOCK TABLES `asn_line_items` WRITE;
/*!40000 ALTER TABLE `asn_line_items` DISABLE KEYS */;
INSERT INTO `asn_line_items` VALUES ('2d0432da-4c89-492c-a495-30f44346e611','94464ca3-3361-47a9-804b-655e5ef8b8ce','e3d5bf55-6758-4f0e-8b67-04cbabc8c9c2',1,'ACB Panel',12.000,1500000.00),('7fecf0fb-3877-41a3-8909-59df8c6a106f','a1686345-6595-448b-9b6f-3fcce4f3dad1','305bf8e5-81e1-4d4a-8031-02d434a561e4',1,'ACB Panel',1.000,125000.00),('847f66f1-b1c6-4a36-990e-10b1eb519ceb','0cc94639-c532-4306-aaa9-2f6f1d6eca46','2d3fe17f-b695-4fcf-8f9e-7b540831f590',1,'ACB Panel',1.000,123000.00),('caaf458f-e3bf-4433-966e-9239e3b750b7','a7f44c68-4338-457b-9310-d5dfd4bcef85','7f55b0c2-8d5b-48b9-a1d9-7c1ec970d8d7',1,'ACB Panel',1.000,120000.00),('f0729f7f-dafd-4b29-9694-e179fdfb6cc8','7618231f-9761-473e-ac74-bdf94a3ec525','7436ae75-6c4d-4728-ab9f-8bc8a4456184',1,'ACB Panel',1.000,122000.00);
/*!40000 ALTER TABLE `asn_line_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asns`
--

DROP TABLE IF EXISTS `asns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asns` (
  `id` varchar(36) NOT NULL,
  `asn_number` varchar(50) DEFAULT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `po_id` varchar(36) NOT NULL,
  `eta` date NOT NULL,
  `invoice_number` varchar(100) NOT NULL,
  `total_amount` decimal(15,2) NOT NULL,
  `invoice_pdf_path` varchar(500) DEFAULT NULL,
  `lr_number` varchar(100) NOT NULL,
  `transporter_name` varchar(255) NOT NULL,
  `driver_name` varchar(255) NOT NULL,
  `driver_number` varchar(20) DEFAULT NULL,
  `reference_doc_path` varchar(500) DEFAULT NULL,
  `excel_attachment_path` varchar(500) DEFAULT NULL,
  `remarks` text,
  `status` enum('draft','submitted','validated','posted','rejected') DEFAULT 'draft',
  `extraction_results` json DEFAULT NULL,
  `validation_result` json DEFAULT NULL,
  `erp_posting_status` enum('posted','failed','pending') DEFAULT NULL,
  `erp_posting_message` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `approval_workflow_id` varchar(36) DEFAULT NULL,
  `workflow_instance_id` varchar(36) DEFAULT NULL,
  `sla_due_date` datetime DEFAULT NULL,
  `sla_breach_flag` tinyint(1) DEFAULT '0',
  `escalation_level` int DEFAULT '0',
  `external_source` enum('API','Manual','Upload') DEFAULT 'Manual',
  `data_source_reference_id` varchar(100) DEFAULT NULL,
  `soft_delete_flag` tinyint(1) DEFAULT '0',
  `audit_log_reference_id` varchar(36) DEFAULT NULL,
  `shipment_mode` varchar(20) DEFAULT NULL,
  `vehicle_number` varchar(20) DEFAULT NULL,
  `eway_bill_number` varchar(50) DEFAULT NULL,
  `dispatch_date` date DEFAULT NULL,
  `actual_delivery_date` date DEFAULT NULL,
  `invoice_currency` varchar(3) DEFAULT 'INR',
  `exchange_rate` decimal(10,4) DEFAULT '1.0000',
  `cgst_amount` decimal(15,2) DEFAULT '0.00',
  `sgst_amount` decimal(15,2) DEFAULT '0.00',
  `igst_amount` decimal(15,2) DEFAULT '0.00',
  `freight_charges` decimal(15,2) DEFAULT '0.00',
  `three_way_match_status` enum('matched','mismatched','pending') DEFAULT 'pending',
  `discrepancy_flag` tinyint(1) DEFAULT '0',
  `discrepancy_reason` text,
  `transaction_chain_id` varchar(36) DEFAULT NULL,
  `organization_id` varchar(36) DEFAULT NULL,
  `company_id` varchar(36) DEFAULT NULL,
  `business_unit_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_invoice_number` (`invoice_number`),
  UNIQUE KEY `asn_number` (`asn_number`),
  KEY `po_id` (`po_id`),
  KEY `idx_vendor_asn` (`vendor_id`),
  KEY `idx_status_asn` (`status`),
  KEY `idx_asns_chain` (`transaction_chain_id`),
  CONSTRAINT `asns_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`),
  CONSTRAINT `asns_ibfk_2` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asns`
--

LOCK TABLES `asns` WRITE;
/*!40000 ALTER TABLE `asns` DISABLE KEYS */;
INSERT INTO `asns` VALUES ('0cc94639-c532-4306-aaa9-2f6f1d6eca46','ASN-MQZEKEN2','f4cd94c1-52b0-4534-911f-0712ab2ad708','2f95fdb5-27b4-47be-8c63-433bf0bb4225','2026-06-30','INV-23-003',125000.00,NULL,'9899','RAJA','RAJA','989889889',NULL,NULL,'check','posted',NULL,NULL,'posted','Successfully Posted','2026-06-29 15:58:53','2026-06-29 16:03:09',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,'Road','MH12CH1324','34989458948','2026-06-30','2026-06-30','INR',1.0000,1250.00,1250.00,0.00,0.00,'matched',0,NULL,'748892b4-13b1-4cc9-836f-02b4d30d04f6',NULL,NULL,NULL),('7618231f-9761-473e-ac74-bdf94a3ec525','ASN-MQZEH825','919dfc64-281f-4b7f-9b5b-0b02d75a4109','dde4c31f-32e5-4424-b865-2e010cb83b0e','2026-06-30','INV-CHN-003',120000.00,NULL,'LR-3000','raja','raja','878898989',NULL,NULL,'madurai','validated',NULL,NULL,NULL,NULL,'2026-06-29 15:56:25','2026-06-29 15:56:35',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,'Road','MH12CH2345','43546546','2026-06-30','2026-06-30','INR',1.0000,1200.00,1200.00,0.00,120.00,'pending',0,NULL,'748892b4-13b1-4cc9-836f-02b4d30d04f6',NULL,NULL,NULL),('94464ca3-3361-47a9-804b-655e5ef8b8ce','ASN-MQYWN153','919dfc64-281f-4b7f-9b5b-0b02d75a4109','da83a975-cc4c-4990-8b63-1744b2a97e75','2026-07-02','INV-2026-001',1500000.00,NULL,'LR-0023','raja','raja','989887889',NULL,NULL,'check','posted',NULL,NULL,'posted','Successfully Posted','2026-06-29 07:37:03','2026-06-29 07:47:28',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,'Air','MD12CH0089','23343243','2026-06-29','2026-06-30','INR',1.0000,18000.00,18000.00,0.00,120.00,'mismatched',1,NULL,'f4f3e756-9e8e-4460-b395-3bfbedaea076',NULL,NULL,NULL),('a1686345-6595-448b-9b6f-3fcce4f3dad1','ASN-MR0EB30N','f4cd94c1-52b0-4534-911f-0712ab2ad708','f813ab6c-948f-4e26-b850-379a8f2a1f71','2026-07-01','INV-12-001',135000.00,NULL,'LR-0001','RAJA','RAJA','98989898',NULL,NULL,'safely bring the goods','posted',NULL,NULL,'posted','Successfully Posted','2026-06-30 08:39:24','2026-06-30 08:40:13',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,'Road','MH12CH1245','90909090','2026-06-29','2026-07-01','INR',1.0000,1250.00,1250.00,0.00,0.00,'pending',0,NULL,'01a83857-cb2b-4aa6-8194-d253e60a4704',NULL,NULL,NULL),('a7f44c68-4338-457b-9310-d5dfd4bcef85','ASN-MR0H5TVM','f4cd94c1-52b0-4534-911f-0712ab2ad708','527ea671-f3f7-4e40-beac-b0213a7e872a','2026-06-30','INV22',132000.00,NULL,'88jkjkj','raja','raja','989898',NULL,NULL,'sample','validated',NULL,NULL,NULL,NULL,'2026-06-30 09:59:18','2026-06-30 09:59:42',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,'Road','MD12CH1234','232321212','2026-07-01','2026-06-30','INR',1.0000,0.00,0.00,0.00,0.00,'pending',0,NULL,'0bebe3a7-efb5-4768-a23d-a570146f118b',NULL,NULL,NULL);
/*!40000 ALTER TABLE `asns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_checklist_items`
--

DROP TABLE IF EXISTS `audit_checklist_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_checklist_items` (
  `id` varchar(36) NOT NULL,
  `checklist_id` varchar(36) NOT NULL,
  `item_text` varchar(500) NOT NULL,
  `sequence` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `checklist_id` (`checklist_id`),
  CONSTRAINT `audit_checklist_items_ibfk_1` FOREIGN KEY (`checklist_id`) REFERENCES `audit_checklists` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_checklist_items`
--

LOCK TABLES `audit_checklist_items` WRITE;
/*!40000 ALTER TABLE `audit_checklist_items` DISABLE KEYS */;
INSERT INTO `audit_checklist_items` VALUES ('cc238f26-6fee-4648-8c45-95f633e92db5','500e6403-ab6f-48eb-9769-a2db355ab6a6','Check Process Document',1),('f62dc1d4-b3f8-4f9e-aca3-7135a7820fc7','500e6403-ab6f-48eb-9769-a2db355ab6a6','Office environment',3),('f9befa62-cb04-498c-9c86-6c5dfe357a45','500e6403-ab6f-48eb-9769-a2db355ab6a6','Visit office places',2);
/*!40000 ALTER TABLE `audit_checklist_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_checklists`
--

DROP TABLE IF EXISTS `audit_checklists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_checklists` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `category` varchar(100) DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_checklists`
--

LOCK TABLES `audit_checklists` WRITE;
/*!40000 ALTER TABLE `audit_checklists` DISABLE KEYS */;
INSERT INTO `audit_checklists` VALUES ('500e6403-ab6f-48eb-9769-a2db355ab6a6','Quality check','Regular 6 months once check','quality','bf975d4b-1794-4184-aa4f-24e187b1fdc3',1,'2026-06-29 16:25:41');
/*!40000 ALTER TABLE `audit_checklists` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_executions`
--

DROP TABLE IF EXISTS `audit_executions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_executions` (
  `id` varchar(36) NOT NULL,
  `schedule_id` varchar(36) NOT NULL,
  `status` enum('planned','in_progress','completed','closed') DEFAULT 'planned',
  `started_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  `executed_by` varchar(36) DEFAULT NULL,
  `approval_workflow_id` varchar(36) DEFAULT NULL,
  `workflow_instance_id` varchar(36) DEFAULT NULL,
  `sla_due_date` datetime DEFAULT NULL,
  `sla_breach_flag` tinyint(1) DEFAULT '0',
  `escalation_level` int DEFAULT '0',
  `external_source` enum('API','Manual','Upload') DEFAULT 'Manual',
  `data_source_reference_id` varchar(100) DEFAULT NULL,
  `soft_delete_flag` tinyint(1) DEFAULT '0',
  `audit_log_reference_id` varchar(36) DEFAULT NULL,
  `audit_score` decimal(5,2) DEFAULT NULL,
  `compliance_percentage` decimal(5,2) DEFAULT NULL,
  `auditor_user_id` varchar(36) DEFAULT NULL,
  `evidence_attachment_group` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `schedule_id` (`schedule_id`),
  CONSTRAINT `audit_executions_ibfk_1` FOREIGN KEY (`schedule_id`) REFERENCES `audit_schedules` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_executions`
--

LOCK TABLES `audit_executions` WRITE;
/*!40000 ALTER TABLE `audit_executions` DISABLE KEYS */;
INSERT INTO `audit_executions` VALUES ('11cb253e-95c4-467a-a09b-2f1a5064cefb','ff614368-d6bc-4433-93a8-1b18ad5c1179','planned','2026-07-28 18:30:00',NULL,NULL,NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,NULL,NULL,NULL,NULL),('156195c6-d1a8-4c8e-b280-849720830596','5cad68b9-2a98-4d42-9a87-b01131cc3f31','planned','2026-07-21 18:30:00',NULL,NULL,NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,NULL,NULL,NULL,NULL),('48abdcba-579b-4468-92a7-833e4d207f67','5cad68b9-2a98-4d42-9a87-b01131cc3f31','closed','2026-06-30 10:11:33','2026-06-30 10:13:09','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,80.00,80.00,'bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL),('7dcc7aa7-abe6-4f89-a8c8-435da1e8b8df','5cad68b9-2a98-4d42-9a87-b01131cc3f31','planned','2026-07-14 18:30:00',NULL,NULL,NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,NULL,NULL,NULL,NULL),('a09fc211-0c2e-4cab-868a-33b2feb037b2','5cad68b9-2a98-4d42-9a87-b01131cc3f31','planned','2026-07-28 18:30:00',NULL,NULL,NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,NULL,NULL,NULL,NULL),('a4e9e058-3ed1-44d3-a40b-18abb77ce317','5cad68b9-2a98-4d42-9a87-b01131cc3f31','planned','2026-07-07 18:30:00',NULL,NULL,NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,NULL,NULL,NULL,NULL),('b441ce5b-3d2a-44e5-a2a5-0ec56bc098be','ff614368-d6bc-4433-93a8-1b18ad5c1179','planned','2026-07-07 18:30:00',NULL,NULL,NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,NULL,NULL,NULL,NULL),('c2cf7516-00c9-4ac1-88ad-1ea642eb25ce','ff614368-d6bc-4433-93a8-1b18ad5c1179','planned','2026-07-14 18:30:00',NULL,NULL,NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,NULL,NULL,NULL,NULL),('d3e098c4-5766-43fa-b81d-8d08699c72c0','ff614368-d6bc-4433-93a8-1b18ad5c1179','planned','2026-07-21 18:30:00',NULL,NULL,NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,NULL,NULL,NULL,NULL),('f959bbc1-1ea1-45d9-b49e-0d381c1e3220','ff614368-d6bc-4433-93a8-1b18ad5c1179','closed','2026-06-29 16:35:16','2026-06-29 16:36:59','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,8.00,80.00,'bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL);
/*!40000 ALTER TABLE `audit_executions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_findings`
--

DROP TABLE IF EXISTS `audit_findings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_findings` (
  `id` varchar(36) NOT NULL,
  `execution_id` varchar(36) NOT NULL,
  `description` text NOT NULL,
  `severity` enum('low','medium','high','critical') NOT NULL,
  `status` enum('open','closed') DEFAULT 'open',
  `assigned_to` varchar(255) DEFAULT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `capa_action_owner` varchar(255) DEFAULT NULL,
  `capa_due_date` date DEFAULT NULL,
  `capa_closure_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `execution_id` (`execution_id`),
  CONSTRAINT `audit_findings_ibfk_1` FOREIGN KEY (`execution_id`) REFERENCES `audit_executions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_findings`
--

LOCK TABLES `audit_findings` WRITE;
/*!40000 ALTER TABLE `audit_findings` DISABLE KEYS */;
INSERT INTO `audit_findings` VALUES ('95b798e7-b0ef-474b-957c-93ffce9cfe17','48abdcba-579b-4468-92a7-833e4d207f67','office is not clean','high','closed',NULL,'2026-06-30 10:13:01','2026-06-30 10:12:17','raja','2026-07-15','2026-06-30'),('a930b33a-ca45-4e74-be85-3c1e2517925c','f959bbc1-1ea1-45d9-b49e-0d381c1e3220','Office places is not clean','high','closed',NULL,'2026-06-29 16:36:53','2026-06-29 16:35:58','Ravi','2026-06-30','2026-06-29');
/*!40000 ALTER TABLE `audit_findings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` varchar(36) NOT NULL,
  `actor_id` varchar(36) DEFAULT NULL,
  `action` varchar(60) NOT NULL,
  `module_name` varchar(60) NOT NULL,
  `record_id` varchar(36) DEFAULT NULL,
  `before_data` json DEFAULT NULL,
  `after_data` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_module_record` (`module_name`,`record_id`),
  KEY `idx_audit_actor` (`actor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES ('80cd8275-aeaa-4642-8cec-a4a9fb544d2e','49e3cf54-b11b-4650-8c57-b57f5d286390','create','company','da3debc2-03ff-4cc8-a99a-322e537020cf',NULL,'{\"id\": \"da3debc2-03ff-4cc8-a99a-322e537020cf\", \"cin\": \"234342321223244312121\", \"pan\": \"2324432311\", \"city\": \"Chennai\", \"gstin\": null, \"state\": \"Tamilnadu\", \"address\": null, \"pin_code\": \"600017\", \"is_active\": 1, \"created_at\": \"2026-06-28T16:09:11.000Z\", \"company_code\": \"SE\", \"company_name\": \"Shanti Electricals\", \"organization_id\": \"93f395fe-1912-4e58-a159-39ffe48bf2b3\", \"certificate_path\": null}','::1','2026-06-28 16:09:11'),('fadc4ab4-5f4a-4166-a415-0c38c11184e5','49e3cf54-b11b-4650-8c57-b57f5d286390','create','company','7156c100-ef23-437f-a38e-afaa71e883db',NULL,'{\"id\": \"7156c100-ef23-437f-a38e-afaa71e883db\", \"cin\": \"234398989121343243443\", \"pan\": \"8789898912\", \"city\": \"Chennai\", \"gstin\": null, \"state\": \"Tamilnadu\", \"address\": null, \"pin_code\": \"600017\", \"is_active\": 1, \"created_at\": \"2026-06-28T16:09:52.000Z\", \"company_code\": \"JC\", \"company_name\": \"Jasmine Concerete Private Limited\", \"organization_id\": \"93f395fe-1912-4e58-a159-39ffe48bf2b3\", \"certificate_path\": null}','::1','2026-06-28 16:09:52');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_responses`
--

DROP TABLE IF EXISTS `audit_responses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_responses` (
  `id` varchar(36) NOT NULL,
  `execution_id` varchar(36) NOT NULL,
  `checklist_item_id` varchar(36) NOT NULL,
  `response` enum('yes','no','na') NOT NULL,
  `remarks` text,
  PRIMARY KEY (`id`),
  KEY `execution_id` (`execution_id`),
  CONSTRAINT `audit_responses_ibfk_1` FOREIGN KEY (`execution_id`) REFERENCES `audit_executions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_responses`
--

LOCK TABLES `audit_responses` WRITE;
/*!40000 ALTER TABLE `audit_responses` DISABLE KEYS */;
INSERT INTO `audit_responses` VALUES ('47bafa4a-d287-4052-a554-e251d159f502','48abdcba-579b-4468-92a7-833e4d207f67','f62dc1d4-b3f8-4f9e-aca3-7135a7820fc7','no','Not applicable'),('5098140f-a8db-45d1-9ea5-7ffc5bbef95e','48abdcba-579b-4468-92a7-833e4d207f67','cc238f26-6fee-4648-8c45-95f633e92db5','yes',NULL),('cd4cec18-f873-47a4-8e98-4cb779f633d9','48abdcba-579b-4468-92a7-833e4d207f67','f9befa62-cb04-498c-9c86-6c5dfe357a45','yes',NULL);
/*!40000 ALTER TABLE `audit_responses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_schedules`
--

DROP TABLE IF EXISTS `audit_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_schedules` (
  `id` varchar(36) NOT NULL,
  `checklist_id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) DEFAULT NULL,
  `vendor_group` varchar(255) DEFAULT NULL,
  `frequency` enum('one_time','weekly','monthly','quarterly') NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `total_audits` int DEFAULT '1',
  `completed_audits` int DEFAULT '0',
  `next_due_date` date DEFAULT NULL,
  `last_run_date` date DEFAULT NULL,
  `status` enum('planned','in_progress','completed') DEFAULT 'planned',
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `checklist_id` (`checklist_id`),
  CONSTRAINT `audit_schedules_ibfk_1` FOREIGN KEY (`checklist_id`) REFERENCES `audit_checklists` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_schedules`
--

LOCK TABLES `audit_schedules` WRITE;
/*!40000 ALTER TABLE `audit_schedules` DISABLE KEYS */;
INSERT INTO `audit_schedules` VALUES ('5cad68b9-2a98-4d42-9a87-b01131cc3f31','500e6403-ab6f-48eb-9769-a2db355ab6a6','f4cd94c1-52b0-4534-911f-0712ab2ad708','gl','weekly','2026-07-01','2026-07-31',5,0,'2026-07-01','2026-06-30','completed','bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-30 10:11:01'),('ff614368-d6bc-4433-93a8-1b18ad5c1179','500e6403-ab6f-48eb-9769-a2db355ab6a6','919dfc64-281f-4b7f-9b5b-0b02d75a4109','check','weekly','2026-07-01','2026-07-31',5,0,'2026-07-01','2026-06-29','completed','bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-29 16:35:06');
/*!40000 ALTER TABLE `audit_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `branch_order_line_items`
--

DROP TABLE IF EXISTS `branch_order_line_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `branch_order_line_items` (
  `id` varchar(36) NOT NULL,
  `branch_order_id` varchar(36) NOT NULL,
  `item_master_id` varchar(36) NOT NULL,
  `requested_quantity` decimal(15,3) NOT NULL,
  `approved_quantity` decimal(15,3) DEFAULT NULL,
  `received_quantity` decimal(15,3) DEFAULT NULL,
  `variance` decimal(15,3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `item_master_id` (`item_master_id`),
  KEY `idx_boli_order` (`branch_order_id`),
  CONSTRAINT `branch_order_line_items_ibfk_1` FOREIGN KEY (`branch_order_id`) REFERENCES `branch_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `branch_order_line_items_ibfk_2` FOREIGN KEY (`item_master_id`) REFERENCES `item_master` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `branch_order_line_items`
--

LOCK TABLES `branch_order_line_items` WRITE;
/*!40000 ALTER TABLE `branch_order_line_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `branch_order_line_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `branch_orders`
--

DROP TABLE IF EXISTS `branch_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `branch_orders` (
  `id` varchar(36) NOT NULL,
  `order_number` varchar(50) NOT NULL,
  `from_location_id` varchar(36) NOT NULL,
  `to_location_id` varchar(36) NOT NULL,
  `requesting_branch` varchar(36) NOT NULL,
  `request_type` varchar(100) NOT NULL,
  `request_date` date NOT NULL,
  `status` enum('created','approved','in_transit','received') NOT NULL DEFAULT 'created',
  `remarks` text,
  `created_by` varchar(36) DEFAULT NULL,
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `dispatched_at` timestamp NULL DEFAULT NULL,
  `received_at` timestamp NULL DEFAULT NULL,
  `received_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_number` (`order_number`),
  KEY `requesting_branch` (`requesting_branch`),
  KEY `idx_bo_status` (`status`),
  KEY `idx_bo_from` (`from_location_id`),
  KEY `idx_bo_to` (`to_location_id`),
  CONSTRAINT `branch_orders_ibfk_1` FOREIGN KEY (`from_location_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `branch_orders_ibfk_2` FOREIGN KEY (`to_location_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `branch_orders_ibfk_3` FOREIGN KEY (`requesting_branch`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `branch_orders`
--

LOCK TABLES `branch_orders` WRITE;
/*!40000 ALTER TABLE `branch_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `branch_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `budget_allocations`
--

DROP TABLE IF EXISTS `budget_allocations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_allocations` (
  `id` varchar(36) NOT NULL,
  `cost_center` varchar(100) NOT NULL,
  `fiscal_year` varchar(9) NOT NULL,
  `allocated_amount` decimal(15,2) NOT NULL,
  `consumed_amount` decimal(15,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `committed_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `actual_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_budget_cc_year` (`cost_center`,`fiscal_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_allocations`
--

LOCK TABLES `budget_allocations` WRITE;
/*!40000 ALTER TABLE `budget_allocations` DISABLE KEYS */;
INSERT INTO `budget_allocations` VALUES ('5b51407d-4a3c-48d6-ba91-d947d26f6d82','CC-001','2026',20000000.00,2115000.00,'2026-06-29 03:25:27','2026-06-30 09:53:59',2184500.00,0.00);
/*!40000 ALTER TABLE `budget_allocations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `business_unit_master`
--

DROP TABLE IF EXISTS `business_unit_master`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `business_unit_master` (
  `id` varchar(36) NOT NULL,
  `company_id` varchar(36) NOT NULL,
  `bu_code` varchar(20) NOT NULL,
  `bu_name` varchar(150) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bu_company_code` (`company_id`,`bu_code`),
  CONSTRAINT `business_unit_master_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `company_master` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `business_unit_master`
--

LOCK TABLES `business_unit_master` WRITE;
/*!40000 ALTER TABLE `business_unit_master` DISABLE KEYS */;
/*!40000 ALTER TABLE `business_unit_master` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cashflow_projection`
--

DROP TABLE IF EXISTS `cashflow_projection`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cashflow_projection` (
  `id` varchar(36) NOT NULL,
  `bucket_date` date NOT NULL,
  `expected_outflow` decimal(15,2) NOT NULL DEFAULT '0.00',
  `schedule_count` int NOT NULL DEFAULT '0',
  `computed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cashflow_bucket` (`bucket_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cashflow_projection`
--

LOCK TABLES `cashflow_projection` WRITE;
/*!40000 ALTER TABLE `cashflow_projection` DISABLE KEYS */;
/*!40000 ALTER TABLE `cashflow_projection` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `company_master`
--

DROP TABLE IF EXISTS `company_master`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `company_master` (
  `id` varchar(36) NOT NULL,
  `organization_id` varchar(36) NOT NULL,
  `company_code` varchar(20) NOT NULL,
  `company_name` varchar(150) NOT NULL,
  `gstin` varchar(15) DEFAULT NULL,
  `address` text,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `cin` varchar(21) DEFAULT NULL,
  `pan` varchar(10) DEFAULT NULL,
  `certificate_path` varchar(500) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `pin_code` varchar(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `company_code` (`company_code`),
  KEY `idx_company_org` (`organization_id`),
  CONSTRAINT `company_master_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organization_master` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `company_master`
--

LOCK TABLES `company_master` WRITE;
/*!40000 ALTER TABLE `company_master` DISABLE KEYS */;
INSERT INTO `company_master` VALUES ('7156c100-ef23-437f-a38e-afaa71e883db','93f395fe-1912-4e58-a159-39ffe48bf2b3','JC','Jasmine Concerete Private Limited',NULL,NULL,1,'2026-06-28 16:09:52','234398989121343243443','8789898912',NULL,'Chennai','Tamilnadu','600017'),('da3debc2-03ff-4cc8-a99a-322e537020cf','93f395fe-1912-4e58-a159-39ffe48bf2b3','SE','Shanti Electricals',NULL,NULL,1,'2026-06-28 16:09:11','234342321223244312121','2324432311',NULL,'Chennai','Tamilnadu','600017');
/*!40000 ALTER TABLE `company_master` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `company_sap_mapping`
--

DROP TABLE IF EXISTS `company_sap_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `company_sap_mapping` (
  `id` varchar(36) NOT NULL,
  `company_id` varchar(36) NOT NULL,
  `sap_company_code` varchar(20) NOT NULL,
  `sap_system_id` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_company_sap` (`company_id`),
  CONSTRAINT `company_sap_mapping_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `company_master` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `company_sap_mapping`
--

LOCK TABLES `company_sap_mapping` WRITE;
/*!40000 ALTER TABLE `company_sap_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `company_sap_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contracts`
--

DROP TABLE IF EXISTS `contracts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contracts` (
  `id` varchar(36) NOT NULL,
  `contract_number` varchar(50) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `payment_terms` varchar(100) DEFAULT NULL,
  `currency` varchar(3) DEFAULT 'INR',
  `contract_value` decimal(15,2) DEFAULT NULL,
  `status` enum('active','expired','terminated') DEFAULT 'active',
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `consumed_value` decimal(15,2) NOT NULL DEFAULT '0.00',
  `default_unit_price` decimal(15,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `contract_number` (`contract_number`),
  KEY `idx_contract_vendor` (`vendor_id`),
  KEY `idx_contract_status` (`status`),
  CONSTRAINT `contracts_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contracts`
--

LOCK TABLES `contracts` WRITE;
/*!40000 ALTER TABLE `contracts` DISABLE KEYS */;
INSERT INTO `contracts` VALUES ('b0fb70d1-0f85-4848-9b51-15451f548470','CON-000002','919dfc64-281f-4b7f-9b5b-0b02d75a4109','Annual Rate Contract','2026-06-28','2026-07-31','Net 30','INR',2500000.00,'active','bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-29 07:13:02','2026-06-29 07:13:02',0.00,NULL),('bbb2a865-985d-4775-a8fa-e30f9b5db0eb','CON-000001','f4cd94c1-52b0-4534-911f-0712ab2ad708','Annual Rate Contracts','2026-06-28','2027-03-31','Net 30','INR',10000000.00,'active','bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-29 03:55:08','2026-06-29 03:55:08',0.00,NULL);
/*!40000 ALTER TABLE `contracts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `decision_outputs`
--

DROP TABLE IF EXISTS `decision_outputs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `decision_outputs` (
  `id` varchar(36) NOT NULL,
  `rule_id` varchar(36) NOT NULL,
  `module_name` varchar(60) NOT NULL,
  `record_id` varchar(36) NOT NULL,
  `output` json NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `rule_id` (`rule_id`),
  KEY `idx_decision_outputs_record` (`module_name`,`record_id`),
  CONSTRAINT `decision_outputs_ibfk_1` FOREIGN KEY (`rule_id`) REFERENCES `decision_rules` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `decision_outputs`
--

LOCK TABLES `decision_outputs` WRITE;
/*!40000 ALTER TABLE `decision_outputs` DISABLE KEYS */;
INSERT INTO `decision_outputs` VALUES ('1291c36a-33a8-4101-8376-a37dbb466a90','3a67ee8d-54fd-45f1-92cc-55d1ad2b71c4','pr','01a83857-cb2b-4aa6-8194-d253e60a4704','{\"message\": \"Requisition exceeds 1,00,000 — consider RFQ or contract pricing.\", \"rule_name\": \"High value PR cost insight\", \"output_type\": \"cost_insight\"}','2026-06-30 08:26:02'),('579b91ad-ebf2-4b95-a7f6-c15f0ca7b074','3a67ee8d-54fd-45f1-92cc-55d1ad2b71c4','pr','748892b4-13b1-4cc9-836f-02b4d30d04f6','{\"message\": \"Requisition exceeds 1,00,000 — consider RFQ or contract pricing.\", \"rule_name\": \"High value PR cost insight\", \"output_type\": \"cost_insight\"}','2026-06-29 15:31:31'),('80f35fdc-0ad5-4d0f-9f93-4f740cdb18e1','3a67ee8d-54fd-45f1-92cc-55d1ad2b71c4','pr','f4f3e756-9e8e-4460-b395-3bfbedaea076','{\"message\": \"Requisition exceeds 1,00,000 — consider RFQ or contract pricing.\", \"rule_name\": \"High value PR cost insight\", \"output_type\": \"cost_insight\"}','2026-06-29 04:08:34'),('f0352bfe-c4d9-4199-8318-fdbc7b8498a3','3a67ee8d-54fd-45f1-92cc-55d1ad2b71c4','pr','0bebe3a7-efb5-4768-a23d-a570146f118b','{\"message\": \"Requisition exceeds 1,00,000 — consider RFQ or contract pricing.\", \"rule_name\": \"High value PR cost insight\", \"output_type\": \"cost_insight\"}','2026-06-30 09:44:36');
/*!40000 ALTER TABLE `decision_outputs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `decision_rules`
--

DROP TABLE IF EXISTS `decision_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `decision_rules` (
  `id` varchar(36) NOT NULL,
  `rule_name` varchar(150) NOT NULL,
  `module_name` enum('pr','rfq','po','invoice') NOT NULL,
  `conditions` json DEFAULT NULL,
  `output_type` enum('best_vendor','risk_alert','budget_alert','cost_insight') NOT NULL,
  `output_template` json DEFAULT NULL,
  `priority` int NOT NULL DEFAULT '100',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_decision_rules_module` (`module_name`,`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `decision_rules`
--

LOCK TABLES `decision_rules` WRITE;
/*!40000 ALTER TABLE `decision_rules` DISABLE KEYS */;
INSERT INTO `decision_rules` VALUES ('3a67ee8d-54fd-45f1-92cc-55d1ad2b71c4','High value PR cost insight','pr','[{\"field\": \"total_value\", \"value\": 100000, \"operator\": \">\"}]','cost_insight','{\"message\": \"Requisition exceeds 1,00,000 — consider RFQ or contract pricing.\"}',10,1,'2026-06-28 16:07:59'),('d12dca10-9ddf-4856-978e-825129696f53','Low budget headroom risk alert','pr','[{\"field\": \"budget_remaining_pct\", \"value\": 15, \"operator\": \"<\"}]','risk_alert','{\"message\": \"Less than 15% budget remains for this cost center.\"}',10,1,'2026-06-28 16:07:59');
/*!40000 ALTER TABLE `decision_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `document_flow_mapping`
--

DROP TABLE IF EXISTS `document_flow_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_flow_mapping` (
  `id` varchar(36) NOT NULL,
  `source_doc_type` enum('PR','RFQ') NOT NULL,
  `source_line_id` varchar(36) NOT NULL,
  `target_doc_type` enum('RFQ','PO') NOT NULL,
  `target_line_id` varchar(36) NOT NULL,
  `mapped_quantity` decimal(15,3) NOT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dfm_source` (`source_doc_type`,`source_line_id`),
  KEY `idx_dfm_target` (`target_doc_type`,`target_line_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `document_flow_mapping`
--

LOCK TABLES `document_flow_mapping` WRITE;
/*!40000 ALTER TABLE `document_flow_mapping` DISABLE KEYS */;
INSERT INTO `document_flow_mapping` VALUES ('4564b9f6-94fc-4610-91eb-fb5287568640','PR','b920a019-49a7-4c11-82fb-bed6d0cc0dc5','RFQ','4a477d88-fb4e-439e-89d3-8bba5161851e',1.000,'bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-30 09:46:52'),('4d1058c2-6779-4faa-8fff-8bc8557f8549','RFQ','9e86d0f8-5a12-42d7-a903-22a4833be4f8','PO','e3d5bf55-6758-4f0e-8b67-04cbabc8c9c2',12.000,'bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-29 07:13:58'),('610b6b9d-3678-4593-b132-463b2ad918fd','PR','28ca7735-70ba-4044-985f-354a13aacbcc','RFQ','9e86d0f8-5a12-42d7-a903-22a4833be4f8',12.000,'bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-29 04:18:16'),('8ed3cbda-e091-426a-bc42-e567bb1407f2','RFQ','04cb4d79-38ae-4477-8c9d-907f5f13640f','PO','7436ae75-6c4d-4728-ab9f-8bc8a4456184',1.000,'bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-29 15:53:25'),('ae122240-ecb1-4567-a555-e1534d7d5e07','PR','67b92852-1d52-4438-8c19-860f672cc1ab','RFQ','5a852a01-1a02-4fc0-9021-d6397e233aef',2.000,'bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-30 08:30:40'),('bb149f17-a334-4797-af3b-31183dba4be2','RFQ','04cb4d79-38ae-4477-8c9d-907f5f13640f','PO','2d3fe17f-b695-4fcf-8f9e-7b540831f590',1.000,'bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-29 15:53:25'),('c20863a3-e1f5-4ac6-b789-443cc6cb0472','RFQ','5a852a01-1a02-4fc0-9021-d6397e233aef','PO','305bf8e5-81e1-4d4a-8031-02d434a561e4',2.000,'bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-30 08:37:03'),('c4cc6b31-3777-49a6-804e-c0d0bfa37141','PR','95e6d8b0-4162-47e8-9840-8b5c7f18ea1f','RFQ','04cb4d79-38ae-4477-8c9d-907f5f13640f',2.000,'bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-29 15:32:03'),('c87953df-47e7-46d8-a6bb-dca8628fe159','RFQ','4a477d88-fb4e-439e-89d3-8bba5161851e','PO','7f55b0c2-8d5b-48b9-a1d9-7c1ec970d8d7',1.000,'bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-30 09:53:59');
/*!40000 ALTER TABLE `document_flow_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `documents`
--

DROP TABLE IF EXISTS `documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `documents` (
  `id` varchar(36) NOT NULL,
  `document_group_id` varchar(36) NOT NULL,
  `module_name` varchar(100) NOT NULL,
  `record_id` varchar(36) DEFAULT NULL,
  `file_type` varchar(50) DEFAULT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_url` varchar(500) NOT NULL,
  `uploaded_by` varchar(36) DEFAULT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expiry_date` date DEFAULT NULL,
  `verification_status` enum('pending','verified','rejected') DEFAULT 'pending',
  PRIMARY KEY (`id`),
  KEY `idx_doc_group` (`document_group_id`),
  KEY `idx_doc_module_record` (`module_name`,`record_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `documents`
--

LOCK TABLES `documents` WRITE;
/*!40000 ALTER TABLE `documents` DISABLE KEYS */;
INSERT INTO `documents` VALUES ('413c87af-7559-45fb-b716-6e8244697193','image','purchase_requisition','001','image','Screenshot 2026-06-29 at 1.12.39â¯PM.png','uploads/aa215fb3-8844-4e05-b202-622af9dde390.png','bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-29 16:44:21','2026-06-30','verified');
/*!40000 ALTER TABLE `documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `event_log`
--

DROP TABLE IF EXISTS `event_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `event_log` (
  `id` varchar(36) NOT NULL,
  `event_type` varchar(60) NOT NULL,
  `module_name` varchar(60) DEFAULT NULL,
  `record_id` varchar(36) DEFAULT NULL,
  `payload` json DEFAULT NULL,
  `status` enum('processed','failed') NOT NULL DEFAULT 'processed',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_event_type` (`event_type`),
  KEY `idx_event_record` (`module_name`,`record_id`),
  KEY `idx_event_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `event_log`
--

LOCK TABLES `event_log` WRITE;
/*!40000 ALTER TABLE `event_log` DISABLE KEYS */;
INSERT INTO `event_log` VALUES ('0222da73-7e6f-4962-96f5-e7610b3dccb8','PR_SUBMITTED','system',NULL,NULL,'processed','2026-07-02 12:33:36'),('0741e656-e073-4f7b-a3ba-4250b46314d8','PR_APPROVED','system',NULL,NULL,'processed','2026-07-02 12:33:36'),('0ed7f6c1-448e-473f-b57b-843ca273f55c','PR_APPROVED','pr','01a83857-cb2b-4aa6-8194-d253e60a4704','{\"pr_number\": \"PR-000003\", \"record_id\": \"01a83857-cb2b-4aa6-8194-d253e60a4704\", \"module_name\": \"pr\", \"final_status\": \"approved\", \"approved_value\": 257000}','processed','2026-06-30 08:30:00'),('35b104d3-4b88-4d79-a1aa-cd88e862dc54','RFQ_PUBLISHED','system',NULL,NULL,'processed','2026-07-02 12:33:36'),('5cea27bb-4bb2-4a55-8300-52ed5d0dcbf5','INVOICE_APPROVED','asn','1072f981-47b2-448b-bb30-9ab2aef98283','{\"asn_id\": \"a1686345-6595-448b-9b6f-3fcce4f3dad1\", \"record_id\": \"1072f981-47b2-448b-bb30-9ab2aef98283\", \"module_name\": \"asn\", \"total_amount\": \"135000.00\", \"invoice_number\": \"INV-12-001\"}','processed','2026-06-30 08:40:11'),('5e2d1aeb-489a-4ff7-83f4-68237c01502d','GRN_COMPLETED','asn','2a103954-d98a-434a-a32f-a90a5863ec14','{\"po_id\": \"2f95fdb5-27b4-47be-8c63-433bf0bb4225\", \"asn_id\": \"0cc94639-c532-4306-aaa9-2f6f1d6eca46\", \"record_id\": \"2a103954-d98a-434a-a32f-a90a5863ec14\", \"grn_number\": \"GRN-000002\", \"module_name\": \"asn\"}','processed','2026-06-29 16:02:15'),('6a3212ae-48c9-4504-8579-f590f43cbd3c','INVOICE_APPROVED','asn','1612f157-db8f-45ec-9a55-f9f337ced20c','{\"asn_id\": \"a7f44c68-4338-457b-9310-d5dfd4bcef85\", \"record_id\": \"1612f157-db8f-45ec-9a55-f9f337ced20c\", \"module_name\": \"asn\", \"total_amount\": \"132000.00\", \"invoice_number\": \"INV22\"}','processed','2026-06-30 10:02:34'),('7b4374f6-53be-4587-9880-d55efed85bed','PR_APPROVED','pr','f4f3e756-9e8e-4460-b395-3bfbedaea076','{\"pr_number\": \"PR-000001\", \"record_id\": \"f4f3e756-9e8e-4460-b395-3bfbedaea076\", \"module_name\": \"pr\", \"final_status\": \"approved\", \"approved_value\": 1542000}','processed','2026-06-29 04:16:08'),('83765896-e6a5-4a0f-b54d-400f2718b273','GRN_COMPLETED','asn','0775ca64-b42e-454c-ad88-786a1d1ef147','{\"po_id\": \"dde4c31f-32e5-4424-b865-2e010cb83b0e\", \"asn_id\": \"7618231f-9761-473e-ac74-bdf94a3ec525\", \"record_id\": \"0775ca64-b42e-454c-ad88-786a1d1ef147\", \"grn_number\": \"GRN-000003\", \"module_name\": \"asn\"}','processed','2026-06-29 16:22:43'),('8b5405bc-edb5-4d7c-a85b-d33fffed9494','PR_APPROVED','pr','0bebe3a7-efb5-4768-a23d-a570146f118b','{\"pr_number\": \"PR-000004\", \"record_id\": \"0bebe3a7-efb5-4768-a23d-a570146f118b\", \"module_name\": \"pr\", \"final_status\": \"approved\", \"approved_value\": 128500}','processed','2026-06-30 09:44:49'),('9005f7b7-a69b-4f3d-a603-7a95b5f6fe7c','INVOICE_APPROVED','asn','821d315f-f4eb-4e33-a2e3-4f9e57b8d731','{\"asn_id\": \"0cc94639-c532-4306-aaa9-2f6f1d6eca46\", \"record_id\": \"821d315f-f4eb-4e33-a2e3-4f9e57b8d731\", \"module_name\": \"asn\", \"total_amount\": \"125000.00\", \"invoice_number\": \"INV-23-003\"}','processed','2026-06-29 16:02:19'),('9192d144-a057-4f46-a2b8-f6f1580b36bc','INVOICE_APPROVED','asn','492d3c3d-e5ff-4ab2-b259-da43f756bd5e','{\"asn_id\": \"94464ca3-3361-47a9-804b-655e5ef8b8ce\", \"record_id\": \"492d3c3d-e5ff-4ab2-b259-da43f756bd5e\", \"module_name\": \"asn\", \"total_amount\": \"1500000.00\", \"invoice_number\": \"INV-2026-001\"}','processed','2026-06-29 07:46:57'),('975d8767-8642-4218-9518-ef54cbeca66d','GRN_COMPLETED','asn','ef91bdd5-abee-4601-8683-bd74a15aab0c','{\"po_id\": \"527ea671-f3f7-4e40-beac-b0213a7e872a\", \"asn_id\": \"a7f44c68-4338-457b-9310-d5dfd4bcef85\", \"record_id\": \"ef91bdd5-abee-4601-8683-bd74a15aab0c\", \"grn_number\": \"GRN-000005\", \"module_name\": \"asn\"}','processed','2026-06-30 10:00:47'),('9f2f4f07-c5f5-42c4-be2a-e9aa3706b41c','ASN_SUBMITTED','system',NULL,NULL,'processed','2026-07-02 12:33:36'),('c2156433-6a54-4c18-a733-be4767dfa340','GRN_COMPLETED','asn','336a7f04-d119-446e-b027-52c6ce9943c2','{\"po_id\": \"f813ab6c-948f-4e26-b850-379a8f2a1f71\", \"asn_id\": \"a1686345-6595-448b-9b6f-3fcce4f3dad1\", \"record_id\": \"336a7f04-d119-446e-b027-52c6ce9943c2\", \"grn_number\": \"GRN-000004\", \"module_name\": \"asn\"}','processed','2026-06-30 08:40:00'),('d9b8fa2b-b068-4295-85da-b213baa830c5','PR_APPROVED','pr','748892b4-13b1-4cc9-836f-02b4d30d04f6','{\"pr_number\": \"PR-000002\", \"record_id\": \"748892b4-13b1-4cc9-836f-02b4d30d04f6\", \"module_name\": \"pr\", \"final_status\": \"approved\", \"approved_value\": 257000}','processed','2026-06-29 15:31:37'),('e04bc183-a6e7-40e9-b858-a6fbc6e10633','GRN_COMPLETED','asn','9693f42f-03c6-49d5-9bc0-4b7b9ed6e6c8','{\"po_id\": \"da83a975-cc4c-4990-8b63-1744b2a97e75\", \"asn_id\": \"94464ca3-3361-47a9-804b-655e5ef8b8ce\", \"record_id\": \"9693f42f-03c6-49d5-9bc0-4b7b9ed6e6c8\", \"grn_number\": \"GRN-000001\", \"module_name\": \"asn\"}','processed','2026-06-29 07:46:53'),('f615eb47-966d-4dab-9f25-41506a523830','PO_CREATED','system',NULL,NULL,'processed','2026-07-02 12:33:36'),('f86aa058-18b5-4291-9384-8a09edd52c71','GRN_COMPLETED','system',NULL,NULL,'processed','2026-07-02 12:33:36');
/*!40000 ALTER TABLE `event_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `extraction_configs`
--

DROP TABLE IF EXISTS `extraction_configs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `extraction_configs` (
  `id` varchar(36) NOT NULL,
  `field_name` varchar(100) NOT NULL,
  `aliases` json NOT NULL,
  `regex_pattern` varchar(500) DEFAULT NULL,
  `priority` enum('high','medium','low') DEFAULT 'medium',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `extraction_configs`
--

LOCK TABLES `extraction_configs` WRITE;
/*!40000 ALTER TABLE `extraction_configs` DISABLE KEYS */;
INSERT INTO `extraction_configs` VALUES ('2c75bd89-3f26-418a-b91e-d3a1d8a7bf48','Invoice Number','[\"invoice number\", \"invoice no\", \"inv no\", \"bill no\"]','[A-Z0-9-/]+','high',1,'2026-06-28 16:07:59','2026-06-28 16:07:59'),('3878f13d-8568-45a3-8dee-9d7e89faec4f','Total Amount','[\"total amount\", \"total\", \"grand total\", \"net amount\"]','[\\d,]+\\.?\\d*','high',1,'2026-06-28 16:07:59','2026-06-28 16:07:59'),('79f8fea1-0b55-4a81-be0c-697053545c69','GST Number','[\"gstin\", \"gst no\", \"gst number\"]','\\d{2}[A-Z]{5}\\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]','medium',1,'2026-06-28 16:07:59','2026-06-28 16:07:59'),('9389247a-4460-49bf-9c98-0b9e1440b76e','PO Number','[\"po number\", \"purchase order\", \"po no\"]','PO-?\\d+','medium',1,'2026-06-28 16:07:59','2026-06-28 16:07:59'),('f321c018-7146-468f-865b-dea71d476189','Invoice Date','[\"invoice date\", \"inv date\", \"date\", \"bill date\"]','\\d{2}[/-]\\d{2}[/-]\\d{4}','high',1,'2026-06-28 16:07:59','2026-06-28 16:07:59');
/*!40000 ALTER TABLE `extraction_configs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `field_requirements`
--

DROP TABLE IF EXISTS `field_requirements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `field_requirements` (
  `id` varchar(36) NOT NULL,
  `module_key` varchar(50) NOT NULL,
  `field_key` varchar(100) NOT NULL,
  `field_label` varchar(150) NOT NULL,
  `section` varchar(100) DEFAULT NULL,
  `is_mandatory` tinyint(1) NOT NULL DEFAULT '0',
  `display_order` int DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `condition_rule` json DEFAULT NULL,
  `visible_roles` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_module_field` (`module_key`,`field_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `field_requirements`
--

LOCK TABLES `field_requirements` WRITE;
/*!40000 ALTER TABLE `field_requirements` DISABLE KEYS */;
INSERT INTO `field_requirements` VALUES ('024f50e8-862f-43a5-89eb-cb06eb0f1183','purchase_requisition','required_date','Required Date','Basic Information',0,135,'2026-06-28 16:12:16',NULL,NULL),('073daeb5-d452-47c5-be42-a578b119a8c4','vendor','trade_name','Trade Name','Business Information',0,17,'2026-06-28 16:12:16',NULL,NULL),('0c6d81c6-a17c-477a-925a-c5a56fd572ed','item_master','uom','UOM','Details',0,85,'2026-06-28 16:12:16',NULL,NULL),('0c8d0109-7f38-4be9-96a1-a20a16fd8bb4','asn','actual_delivery_date','Actual Delivery Date','Shipment Details',0,49,'2026-06-28 16:12:16',NULL,NULL),('0dce26c2-6e0e-4e26-be93-6f353a313ca4','vendor','vendor_name','Vendor Name','Basic Information',1,1,'2026-06-28 16:12:16',NULL,NULL),('0dd98665-2f00-402d-9525-33997747f723','asn','lr_number','LR Number','Mandatory Details',1,36,'2026-06-28 16:12:16',NULL,NULL),('0e1dd5b4-8eba-4540-a7a3-6026deae3c2d','user_management','role','Role','User',1,95,'2026-06-28 16:12:16',NULL,NULL),('1296ba61-ff02-44d7-95a2-5e11929d3133','asn','vehicle_number','Vehicle Number','Shipment Details',0,46,'2026-06-28 16:12:16',NULL,NULL),('13275a81-448f-4477-930e-d3fbf1aa4552','rfq_bid','bid_remarks','Overall Bid Remarks','Bid Remarks',0,81,'2026-06-28 16:12:16',NULL,NULL),('183d8663-44af-44c2-a083-1c0877889258','ticket','description','Description','Create Ticket',1,98,'2026-06-28 16:12:16',NULL,NULL),('189d527c-d9fe-4466-8faa-14d4af4a7c99','rfq','rfq_type','RFQ Type','RFQ Type & Category',0,76,'2026-06-28 16:12:16',NULL,NULL),('18a620f7-0849-4234-b2ed-e36859d540ff','audit_schedule','vendor_group','Vendor Group','Schedule',0,112,'2026-06-28 16:12:16',NULL,NULL),('1a872e45-46d1-493a-a298-dd57f306e84b','purchase_requisition','contract_id','Contract','Smart Controls',0,137,'2026-06-28 16:12:16',NULL,NULL),('1fad5064-eb4e-4207-9e59-39311e59d8ed','vendor','email','Email','Basic Information',1,2,'2026-06-28 16:12:16',NULL,NULL),('1fce8c86-4454-4e07-937c-01edd70519cc','vendor','geo_latitude','Geo Latitude','Governance',0,29,'2026-06-28 16:12:16',NULL,NULL),('20960d04-f48e-41d3-9fd9-d4169bc2f63b','item_master','category','Category','Details',0,86,'2026-06-28 16:12:16',NULL,NULL),('21b9fb51-7c0a-4c2c-9500-bda1893a4a8d','vendor','supplier_group','Supplier Group','Basic Information',1,6,'2026-06-28 16:12:16',NULL,NULL),('223cf240-dbd9-4879-acfc-41804af51ead','contract','end_date','End Date','Contract Details',1,141,'2026-06-28 16:12:16',NULL,NULL),('250163a4-398f-47f2-aafd-99bd78ea7690','purchase_requisition','preferred_vendor_id','Preferred Vendor','Smart Controls',0,136,'2026-06-28 16:12:16',NULL,NULL),('26d6e6ba-4967-461b-b991-d6a659b7d6db','contract','start_date','Start Date','Contract Details',1,140,'2026-06-28 16:12:16',NULL,NULL),('2796301c-7a90-4e32-b907-167c07bfdbbc','vendor','msme_type','MSME Type','Business Information',0,19,'2026-06-28 16:12:16',NULL,NULL),('287c83bc-8e4b-4005-b4e4-0bfc971198ec','audit_finding','capa_action_owner','CAPA Action Owner','Finding',0,119,'2026-06-28 16:12:16',NULL,NULL),('29d0fd75-9cc3-4a31-95dc-1561c11bd8a3','vendor','phone1','Phone 1','Contact Information',0,21,'2026-06-28 16:12:16',NULL,NULL),('2a5b5856-215f-44fe-86cb-f5db426a7c2d','rfq','title','RFQ Title','Header',1,72,'2026-06-28 16:12:16',NULL,NULL),('2b78b3a8-ab04-4c70-8fb2-888793cbdaf8','contract','payment_terms','Payment Terms','Contract Details',0,142,'2026-06-28 16:12:16',NULL,NULL),('2f5f4570-c37a-4d50-9b99-1482f33467ae','purchase_requisition','department','Department','Basic Information',1,128,'2026-06-28 16:12:16',NULL,NULL),('2f8e6f2c-7032-415e-b6e8-6de532d94b27','asn','po_id','Purchase Order','PO Selection',1,32,'2026-06-28 16:12:16',NULL,NULL),('33289297-a1a9-426e-9139-e8b0cee0c8cf','contract','vendor_id','Vendor','Contract Details',1,138,'2026-06-28 16:12:16',NULL,NULL),('3789ab40-4327-40f4-9592-55c410a9a472','asn','exchange_rate','Exchange Rate','Invoice & Tax Details',0,51,'2026-06-28 16:12:16',NULL,NULL),('38cc1d70-e4a0-42c9-bad5-b9089dbe261b','purchase_requisition','plant','Plant','Basic Information',0,134,'2026-06-28 16:12:16',NULL,NULL),('3901d366-4ee4-4960-8f54-35812f333874','vendor','vendor_code','Vendor Code','Additional Information',0,9,'2026-06-28 16:12:16',NULL,NULL),('3932240f-8cca-4b9a-b88e-4c84e6ac9c9d','asn','additional_info3','Additional Info 3','Optional Fields',0,42,'2026-06-28 16:12:16',NULL,NULL),('398559c1-504d-47a0-ba96-1d97ace7d6b5','audit_schedule','frequency','Frequency','Schedule',1,113,'2026-06-28 16:12:16',NULL,NULL),('39bbda0e-719d-47e4-bf85-65d44136e4f9','asn','cgst_amount','CGST Amount','Invoice & Tax Details',0,53,'2026-06-28 16:12:16',NULL,NULL),('3ba52b5e-73dd-4f2c-96a2-d3464e89d9e6','item_master','subcategory_id','Subcategory (Master)','Details',0,88,'2026-06-28 16:12:16',NULL,NULL),('3bfa9599-1770-44dc-a0dd-7a0d7dc1ccde','asn','eta','ETA','Mandatory Details',1,34,'2026-06-28 16:12:16',NULL,NULL),('3c89867e-44fb-491e-8988-fd6837c481d5','rfq','description','Description','Details',0,74,'2026-06-28 16:12:16',NULL,NULL),('3eeefc4f-b93a-465b-a0a9-20ca64604fa4','vendor','currency_code','Currency','Classification',0,14,'2026-06-28 16:12:16',NULL,NULL),('3f63ed38-6bcb-43b5-b5ff-cfadd74a70a2','item_master','category_id','Category (Master)','Details',0,87,'2026-06-28 16:12:16',NULL,NULL),('3f99b52f-8eda-49dd-b106-1e9196c0183c','ticket','priority','Priority','Create Ticket',1,99,'2026-06-28 16:12:16',NULL,NULL),('3fd80b29-85f7-4fb4-9583-3896230252af','audit_schedule','vendor_id','Vendor','Schedule',0,111,'2026-06-28 16:12:16',NULL,NULL),('40eccc92-f720-4669-ba52-af13ec4e0707','document','expiry_date','Expiry Date','Upload',0,127,'2026-06-28 16:12:16',NULL,NULL),('42ad6d7f-0b00-40c9-88e9-d52c5ff4f2b6','purchase_requisition','project_code','Project Code','Basic Information',0,132,'2026-06-28 16:12:16',NULL,NULL),('493fd621-6da3-48bc-b55b-c367d0f91900','ticket','vendor_ids','Vendors','Create Ticket',1,100,'2026-06-28 16:12:16',NULL,NULL),('4a3dda71-8ee6-42fc-a80d-cf65b4ccc70e','purchase_order','validity_date','PO Validity Date','Buyer & PO Info',0,59,'2026-06-28 16:12:16',NULL,NULL),('4aa83066-3647-41ca-98c8-449196a48201','item_master','currency','Currency','Details',0,92,'2026-06-28 16:12:16',NULL,NULL),('4c88900d-0463-4de3-b74f-a952b84dddf9','rfq','budget_value','Budget Value','RFQ Type & Category',0,78,'2026-06-28 16:12:16',NULL,NULL),('4f2fb589-1b25-4f46-ad37-ca55e9eae863','asn','freight_charges','Freight Charges','Invoice & Tax Details',0,52,'2026-06-28 16:12:16',NULL,NULL),('4fd41a4f-7618-40db-9892-e79232415c09','purchase_order','project_code','Project Code','Contract & Terms',0,69,'2026-06-28 16:12:16',NULL,NULL),('524f2179-9052-412a-993a-2984210b6cc9','asn','dispatch_date','Dispatch Date','Shipment Details',0,48,'2026-06-28 16:12:16',NULL,NULL),('534628ae-79f8-47a6-a508-b008263e8d3f','purchase_order','vendor_id','Vendor (Supplier)','Buyer & PO Info',1,58,'2026-06-28 16:12:16',NULL,NULL),('58b04bcf-2006-4daf-9e04-07ce0d452635','vendor','registration_type','Registration Type','Classification',0,13,'2026-06-28 16:12:16',NULL,NULL),('5cc72d08-7ae3-4270-924a-f5357b87eecc','rfq','submission_deadline','Bid Deadline','Header',1,73,'2026-06-28 16:12:16',NULL,NULL),('5d251e0d-53f4-4f01-91c2-8a61b245ed0e','vendor','account_manager_name','Account Manager','Additional Information',0,10,'2026-06-28 16:12:16',NULL,NULL),('5e3b4e97-bd89-48c9-92c3-3d142274d61b','user_management','email','Email','User',1,94,'2026-06-28 16:12:16',NULL,NULL),('5f44e6f8-f724-42bf-b991-692600c56264','audit_checklist','name','Checklist Name','Checklist',1,107,'2026-06-28 16:12:16',NULL,NULL),('6470aabd-67b9-48bd-b08e-101e51aebf9d','purchase_requisition','sourcing_strategy','Sourcing Strategy','Smart Controls',1,130,'2026-06-28 16:12:16',NULL,NULL),('64e26c3b-1608-4992-8ade-7d4dae41e332','vendor','itr_filing_status','ITR Filing Status','Business Information',0,20,'2026-06-28 16:12:16',NULL,NULL),('64fbc840-9bbc-4628-b862-be30348c9846','ticket_close','root_cause','Root Cause','Close Ticket',0,105,'2026-06-28 16:12:16',NULL,NULL),('67cd06cc-8e54-443b-8fda-9763da1a87b0','purchase_requisition','justification','Justification','Basic Information',1,129,'2026-06-28 16:12:16',NULL,NULL),('6bf2996d-af4b-47b9-b71d-236aa393638b','user_management','password','Password (on create)','User',1,96,'2026-06-28 16:12:16',NULL,NULL),('6dd448c1-ae59-4958-9fbb-24a9c789cc40','asn','additional_info1','Additional Info 1','Optional Fields',0,40,'2026-06-28 16:12:16',NULL,NULL),('6fd871da-a7f0-487b-952c-9ff20052c7b7','audit_complete','audit_score','Audit Score (0-100)','Complete',0,121,'2026-06-28 16:12:16',NULL,NULL),('72bea873-ba21-4d58-ae36-8c5a0310e246','vendor','credit_limit','Credit Limit','Governance',0,27,'2026-06-28 16:12:16',NULL,NULL),('7fa867a3-4b21-4d2a-bc45-c2ccec36221e','item_master','standard_cost','Standard Cost','Details',0,91,'2026-06-28 16:12:16',NULL,NULL),('81d5fa5c-ea9f-4781-bde5-0a02badba6c1','purchase_order','po_number','PO Number','Buyer & PO Info',1,56,'2026-06-28 16:12:16',NULL,NULL),('8234def5-5641-4ad4-b6ea-533d4f9db7c2','item_master','item_description','Item Description','Header',1,83,'2026-06-28 16:12:16',NULL,NULL),('840471fd-c744-4735-8500-f2771877dc9b','audit_checklist','category','Category','Checklist',1,109,'2026-06-28 16:12:16',NULL,NULL),('883aa183-5d4e-4063-8400-239a83b14990','asn','additional_info4','Additional Info 4','Optional Fields',0,43,'2026-06-28 16:12:16',NULL,NULL),('88fc82bd-b219-4729-b8e8-29aac8289083','document','file_type','File Type','Upload',0,125,'2026-06-28 16:12:16',NULL,NULL),('891f1a5a-566d-4d77-8e59-318bcc3014c7','vendor','email2','Email 2','Contact Information',0,24,'2026-06-28 16:12:16',NULL,NULL),('8945b840-2112-4e50-aa58-62ad588dee3e','purchase_requisition','cost_center','Cost Center','Basic Information',0,131,'2026-06-28 16:12:16',NULL,NULL),('89a25f3b-2d8e-4107-88a9-2b58ba8c956b','audit_schedule','checklist_id','Checklist','Schedule',1,110,'2026-06-28 16:12:16',NULL,NULL),('8d229af8-6ffa-4d14-8479-07890d79b807','vendor','company_name','Company','Basic Information',1,4,'2026-06-28 16:12:16',NULL,NULL),('9212c73c-682c-4c62-961c-93afff125302','document','document_group_id','Document Group ID','Upload',0,126,'2026-06-28 16:12:16',NULL,NULL),('9349e4e0-966a-4a43-8d96-8fe12efaf3e1','purchase_requisition','company_code','Company Code','Basic Information',0,133,'2026-06-28 16:12:16',NULL,NULL),('93a78836-3f20-4543-812a-bdd17110113c','document','record_id','Record ID','Upload',0,124,'2026-06-28 16:12:16',NULL,NULL),('9681aae0-0526-4eff-98dc-0369d78eb124','purchase_order','gstin','GSTIN','Buyer Details',0,62,'2026-06-28 16:12:16',NULL,NULL),('98b950ed-7483-4d4a-95f0-3a063559eafb','purchase_order','incoterms','Incoterms','Contract & Terms',0,67,'2026-06-28 16:12:16',NULL,NULL),('99f7ce69-e2dd-48ad-a160-3572994667d4','vendor','geo_longitude','Geo Longitude','Governance',0,30,'2026-06-28 16:12:16',NULL,NULL),('9af19a06-67dd-4a17-b216-9f0cb8b96a29','rfq','procurement_category_id','Procurement Category','RFQ Type & Category',0,77,'2026-06-28 16:12:16',NULL,NULL),('9d2999f1-55d7-4950-9a80-a57b6a1fbc66','asn','driver_name','Driver Name','Mandatory Details',1,38,'2026-06-28 16:12:16',NULL,NULL),('9df1e412-7b75-48c2-8ae8-ed8e92869bf9','asn','eway_bill_number','E-Way Bill Number','Shipment Details',0,47,'2026-06-28 16:12:16',NULL,NULL),('9edca813-9bb8-4f2d-8200-bcb460597e65','purchase_order','contract_id','Contract ID','Contract & Terms',0,66,'2026-06-28 16:12:16',NULL,NULL),('a065955a-85a1-4812-a35e-206bf8bc05e8','ticket_close','rating','Rating','Close Ticket',1,103,'2026-06-28 16:12:16',NULL,NULL),('a335d885-a232-4a92-a2f2-258cec546052','rfq','vendor_ids','Invite Vendors','Vendors',1,75,'2026-06-28 16:12:16',NULL,NULL),('a52f6971-c417-4321-aee4-a35400dcce1c','contract','title','Title','Contract Details',1,139,'2026-06-28 16:12:16',NULL,NULL),('a5f178f9-e6e2-43c7-b306-be1ac1b47017','vendor','risk_category','Risk Category','Governance',0,28,'2026-06-28 16:12:16',NULL,NULL),('a66c450f-4765-4f90-b733-e306dddc0adb','asn','igst_amount','IGST Amount','Invoice & Tax Details',0,55,'2026-06-28 16:12:16',NULL,NULL),('a6b6f711-a9a2-46c3-9fa5-e5769f7f46d3','asn','invoice_number','Invoice Number','Mandatory Details',1,33,'2026-06-28 16:12:16',NULL,NULL),('a93e8c64-3d28-4910-bc61-9045336cfdad','vendor','department','Department','Basic Information',1,5,'2026-06-28 16:12:16',NULL,NULL),('a9bc2973-f975-4441-a145-4c3276b7d968','asn','transporter_name','Transporter','Mandatory Details',1,37,'2026-06-28 16:12:16',NULL,NULL),('a9f2b449-102a-4a3f-9213-3db901a0bd6c','asn','shipment_mode','Shipment Mode','Shipment Details',0,45,'2026-06-28 16:12:16',NULL,NULL),('abe087d0-91d8-4465-981a-b79475ef5e98','contract','contract_value','Contract Value','Contract Details',0,143,'2026-06-28 16:12:16',NULL,NULL),('abf40b55-a651-46de-877f-6f21346b37d5','purchase_order','buyer_name','Buyer Name','Buyer Details',0,60,'2026-06-28 16:12:16',NULL,NULL),('b043cd70-448c-4677-8ea8-71267ae35d93','ticket','subject','Subject','Create Ticket',1,97,'2026-06-28 16:12:16',NULL,NULL),('b290b53d-105f-48c3-bbc2-a5c8c0ba85f5','vendor','vendor_type','Vendor Type','Classification',0,11,'2026-06-28 16:12:16',NULL,NULL),('b68136bd-93c6-4fe7-be6b-8e9a1dc5d7a4','vendor','email1','Email 1','Contact Information',0,23,'2026-06-28 16:12:16',NULL,NULL),('b7124052-01ba-41b9-bad5-9fe7cdd2bdb5','asn','invoice_currency','Invoice Currency','Invoice & Tax Details',0,50,'2026-06-28 16:12:16',NULL,NULL),('b8dd65bf-be99-4dbc-b5a1-0c4d38bbb167','audit_finding','severity','Severity','Finding',1,117,'2026-06-28 16:12:16',NULL,NULL),('ba2d520d-22b5-4c93-88a6-42443f0582f5','vendor','credit_rating','Credit Rating','Governance',0,26,'2026-06-28 16:12:16',NULL,NULL),('ba6e11d0-c29d-42ac-90e7-bea1899bfddd','vendor','supplier_location','Location','Basic Information',1,8,'2026-06-28 16:12:16',NULL,NULL),('c0face74-82e5-4516-b49b-1038fe2ae47c','vendor','supplier_category','Supplier Category','Basic Information',1,7,'2026-06-28 16:12:16',NULL,NULL),('c48fdb18-5686-414d-b12a-f9316e1da9a1','ticket','category','Category','Create Ticket',0,101,'2026-06-28 16:12:16',NULL,NULL),('ca9375ab-ce7c-499f-8370-58e7ead4335f','ticket_close','closure_remarks','Closure Remarks','Close Ticket',1,104,'2026-06-28 16:12:16',NULL,NULL),('cb7db342-4daf-4530-afe2-39168a004044','item_master','uom_id','UOM (Master)','Details',0,89,'2026-06-28 16:12:16',NULL,NULL),('cbdced58-8f58-4687-9a05-cc9254dfbd1e','audit_checklist','description','Description','Checklist',0,108,'2026-06-28 16:12:16',NULL,NULL),('cc982275-38ef-4423-8f83-b8b66cd9a858','purchase_order','state_name','State Name','Buyer Details',0,63,'2026-06-28 16:12:16',NULL,NULL),('ccd0a636-a345-4e59-ba96-4ac32a874c53','ticket','sla_hours','SLA (hours)','Create Ticket',0,102,'2026-06-28 16:12:16',NULL,NULL),('cd29c81e-df00-428e-8564-361eefcc5dca','asn','total_amount','Total Amount','Mandatory Details',1,35,'2026-06-28 16:12:16',NULL,NULL),('cdb36ea7-903d-492c-afac-e5141a4eb564','item_master','hsn_sac_code','HSN/SAC Code','Details',0,90,'2026-06-28 16:12:16',NULL,NULL),('cdcaf7de-a050-43a7-ac16-04c2bf7565d6','ticket_close','resolution_type','Resolution Type','Close Ticket',0,106,'2026-06-28 16:12:16',NULL,NULL),('ced3c16f-8419-4c63-ab42-e81b0ceb93ea','document','module_name','Module','Upload',1,123,'2026-06-28 16:12:16',NULL,NULL),('d1a75e59-d641-47b1-9e60-c5f70af38dcd','vendor','serviceable_regions','Serviceable Regions','Governance',0,31,'2026-06-28 16:12:16',NULL,NULL),('d39f6382-fed5-451b-b10c-cd0b72046856','vendor','payment_terms_id','Payment Terms','Governance',0,25,'2026-06-28 16:12:16',NULL,NULL),('d8310443-6b2e-4563-852d-a80efc80cb07','user_management','full_name','Full Name','User',1,93,'2026-06-28 16:12:16',NULL,NULL),('d877acac-2c0c-4b82-ab02-b3049471a903','purchase_order','retention_percentage','Retention %','Contract & Terms',0,71,'2026-06-28 16:12:16',NULL,NULL),('d96b0cbd-0693-4add-adb7-cb691f69a7f1','asn','sgst_amount','SGST Amount','Invoice & Tax Details',0,54,'2026-06-28 16:12:16',NULL,NULL),('dadd5bb3-78a5-4991-94b1-7fef7f653c34','asn','driver_number','Driver Phone','Optional Fields',0,39,'2026-06-28 16:12:16',NULL,NULL),('de61edc0-5706-4156-b2cd-3ed9a490d811','purchase_order','buyer_address','Buyer Address','Buyer Details',0,61,'2026-06-28 16:12:16',NULL,NULL),('e053a3d7-0311-46a6-9693-f17a4975769b','item_master','item_code','Item Code','Header',1,82,'2026-06-28 16:12:16',NULL,NULL),('e17c7ab8-b2a2-48a4-8d4b-33ca9d19baf3','purchase_order','po_date','PO Date','Buyer & PO Info',1,57,'2026-06-28 16:12:16',NULL,NULL),('e2c9e193-8239-4c4c-aefd-c03b1d35f035','item_master','item_name','Item Name','Header',0,84,'2026-06-28 16:12:16',NULL,NULL),('e34c42bf-1c15-458b-aa50-d56aae9a5fc3','vendor','industry','Industry','Classification',0,12,'2026-06-28 16:12:16',NULL,NULL),('e7dc299e-73c2-46f4-99d0-4795a94d7aa2','asn','remarks','Remarks / Comments','Optional Fields',0,44,'2026-06-28 16:12:16',NULL,NULL),('e847770c-7841-4814-9a31-6b9efa238c74','purchase_order','cost_center','Cost Center','Contract & Terms',0,68,'2026-06-28 16:12:16',NULL,NULL),('ea16338e-dc53-46cf-b243-22a915d96076','audit_finding','assigned_to','Assign Corrective Action To','Finding',0,118,'2026-06-28 16:12:16',NULL,NULL),('eecb706f-175e-4f07-9eba-877d263ec097','vendor','legal_name','Legal Name','Business Information',0,18,'2026-06-28 16:12:16',NULL,NULL),('eed2fa5b-64d8-46c9-85da-6e78bf7a26a1','audit_schedule','start_date','From Date','Schedule',1,114,'2026-06-28 16:12:16',NULL,NULL),('eee2b057-1deb-415f-9b78-ae24cbcac4c8','asn','additional_info2','Additional Info 2','Optional Fields',0,41,'2026-06-28 16:12:16',NULL,NULL),('ef4ea662-0434-4d4a-be4d-018317b3f302','vendor','phone2','Phone 2','Contact Information',0,22,'2026-06-28 16:12:16',NULL,NULL),('efb47e4f-0167-4e14-9fa9-9b6c4506114b','audit_finding','capa_due_date','CAPA Due Date','Finding',0,120,'2026-06-28 16:12:16',NULL,NULL),('f020f7b1-dafc-4faa-b433-33da02b2f4bc','purchase_order','state_code','State Code','Buyer Details',0,64,'2026-06-28 16:12:16',NULL,NULL),('f09539c5-dc14-4c40-be26-439a2567b14d','audit_schedule','end_date','To Date','Schedule',1,115,'2026-06-28 16:12:16',NULL,NULL),('f12cf9aa-f459-4333-a4fc-21d5319fbcca','audit_finding','description','Finding Description','Finding',1,116,'2026-06-28 16:12:16',NULL,NULL),('f31c05d1-0428-4663-b1a6-f181a39dd2c2','rfq_bid','offered_payment_terms','Offered Payment Terms','Bid Terms',0,79,'2026-06-28 16:12:16',NULL,NULL),('f34befd2-d1ef-4844-b8a3-da19a4ce2d56','rfq_bid','warranty_period','Warranty Period','Bid Terms',0,80,'2026-06-28 16:12:16',NULL,NULL),('f3eb2161-d2be-4bff-825a-2fde3b203afd','vendor','phone','Phone','Basic Information',0,3,'2026-06-30 10:23:49',NULL,NULL),('fa24f2a3-96da-4184-8734-4fbf6fd07223','purchase_order','budget_code','Budget Code','Contract & Terms',0,70,'2026-06-28 16:12:16',NULL,NULL),('fafe4657-80a9-4163-a626-fc56c3851098','vendor','pan_number','PAN Number','Business Information',0,16,'2026-06-28 16:12:16',NULL,NULL),('fbb3c1ab-3425-4f79-9c38-ede0b48260e4','purchase_order','terms_of_payment','Terms of Payment','Buyer Details',0,65,'2026-06-28 16:12:16',NULL,NULL),('fbf8cc5c-3478-4709-acc8-a4ba27e97165','audit_complete','compliance_percentage','Compliance Percentage (0-100)','Complete',0,122,'2026-06-28 16:12:16',NULL,NULL),('ff661e3f-52ae-4dc9-aeb2-f2785cf77a18','vendor','gst_number','GST Number','Business Information',0,15,'2026-06-28 16:12:16',NULL,NULL);
/*!40000 ALTER TABLE `field_requirements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `goods_receipt_notes`
--

DROP TABLE IF EXISTS `goods_receipt_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `goods_receipt_notes` (
  `id` varchar(36) NOT NULL,
  `grn_number` varchar(50) NOT NULL,
  `asn_id` varchar(36) NOT NULL,
  `po_id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `received_date` date NOT NULL,
  `received_by` varchar(36) DEFAULT NULL,
  `status` enum('draft','completed','exception') NOT NULL DEFAULT 'draft',
  `remarks` text,
  `transaction_chain_id` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `grn_number` (`grn_number`),
  KEY `po_id` (`po_id`),
  KEY `vendor_id` (`vendor_id`),
  KEY `idx_grn_asn` (`asn_id`),
  KEY `idx_grn_status` (`status`),
  CONSTRAINT `goods_receipt_notes_ibfk_1` FOREIGN KEY (`asn_id`) REFERENCES `asns` (`id`),
  CONSTRAINT `goods_receipt_notes_ibfk_2` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`),
  CONSTRAINT `goods_receipt_notes_ibfk_3` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `goods_receipt_notes`
--

LOCK TABLES `goods_receipt_notes` WRITE;
/*!40000 ALTER TABLE `goods_receipt_notes` DISABLE KEYS */;
INSERT INTO `goods_receipt_notes` VALUES ('0775ca64-b42e-454c-ad88-786a1d1ef147','GRN-000003','7618231f-9761-473e-ac74-bdf94a3ec525','dde4c31f-32e5-4424-b865-2e010cb83b0e','919dfc64-281f-4b7f-9b5b-0b02d75a4109','2026-06-29','bf975d4b-1794-4184-aa4f-24e187b1fdc3','completed',NULL,'748892b4-13b1-4cc9-836f-02b4d30d04f6','2026-06-29 16:22:43','2026-06-29 16:22:43'),('2a103954-d98a-434a-a32f-a90a5863ec14','GRN-000002','0cc94639-c532-4306-aaa9-2f6f1d6eca46','2f95fdb5-27b4-47be-8c63-433bf0bb4225','f4cd94c1-52b0-4534-911f-0712ab2ad708','2026-06-29','bf975d4b-1794-4184-aa4f-24e187b1fdc3','completed',NULL,'748892b4-13b1-4cc9-836f-02b4d30d04f6','2026-06-29 16:02:15','2026-06-29 16:02:15'),('336a7f04-d119-446e-b027-52c6ce9943c2','GRN-000004','a1686345-6595-448b-9b6f-3fcce4f3dad1','f813ab6c-948f-4e26-b850-379a8f2a1f71','f4cd94c1-52b0-4534-911f-0712ab2ad708','2026-06-30','bf975d4b-1794-4184-aa4f-24e187b1fdc3','completed',NULL,'01a83857-cb2b-4aa6-8194-d253e60a4704','2026-06-30 08:40:00','2026-06-30 08:40:00'),('9693f42f-03c6-49d5-9bc0-4b7b9ed6e6c8','GRN-000001','94464ca3-3361-47a9-804b-655e5ef8b8ce','da83a975-cc4c-4990-8b63-1744b2a97e75','919dfc64-281f-4b7f-9b5b-0b02d75a4109','2026-06-29','bf975d4b-1794-4184-aa4f-24e187b1fdc3','completed',NULL,'f4f3e756-9e8e-4460-b395-3bfbedaea076','2026-06-29 07:46:53','2026-06-29 07:46:53'),('ef91bdd5-abee-4601-8683-bd74a15aab0c','GRN-000005','a7f44c68-4338-457b-9310-d5dfd4bcef85','527ea671-f3f7-4e40-beac-b0213a7e872a','f4cd94c1-52b0-4534-911f-0712ab2ad708','2026-06-30','bf975d4b-1794-4184-aa4f-24e187b1fdc3','completed',NULL,'0bebe3a7-efb5-4768-a23d-a570146f118b','2026-06-30 10:00:47','2026-06-30 10:00:47');
/*!40000 ALTER TABLE `goods_receipt_notes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `grn_line_items`
--

DROP TABLE IF EXISTS `grn_line_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `grn_line_items` (
  `id` varchar(36) NOT NULL,
  `grn_id` varchar(36) NOT NULL,
  `asn_line_item_id` varchar(36) NOT NULL,
  `po_line_id` varchar(36) NOT NULL,
  `ordered_quantity` decimal(15,3) NOT NULL,
  `shipped_quantity` decimal(15,3) NOT NULL,
  `received_quantity` decimal(15,3) NOT NULL,
  `accepted_quantity` decimal(15,3) NOT NULL,
  `rejected_quantity` decimal(15,3) NOT NULL DEFAULT '0.000',
  `rejection_reason` text,
  `tolerance_status` enum('within_tolerance','exceeds_tolerance') NOT NULL DEFAULT 'within_tolerance',
  PRIMARY KEY (`id`),
  KEY `grn_id` (`grn_id`),
  KEY `asn_line_item_id` (`asn_line_item_id`),
  KEY `po_line_id` (`po_line_id`),
  CONSTRAINT `grn_line_items_ibfk_1` FOREIGN KEY (`grn_id`) REFERENCES `goods_receipt_notes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `grn_line_items_ibfk_2` FOREIGN KEY (`asn_line_item_id`) REFERENCES `asn_line_items` (`id`),
  CONSTRAINT `grn_line_items_ibfk_3` FOREIGN KEY (`po_line_id`) REFERENCES `po_line_items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `grn_line_items`
--

LOCK TABLES `grn_line_items` WRITE;
/*!40000 ALTER TABLE `grn_line_items` DISABLE KEYS */;
INSERT INTO `grn_line_items` VALUES ('10aeb074-91a7-4d5e-ad22-205fad627c7e','ef91bdd5-abee-4601-8683-bd74a15aab0c','caaf458f-e3bf-4433-966e-9239e3b750b7','7f55b0c2-8d5b-48b9-a1d9-7c1ec970d8d7',1.000,1.000,1.000,1.000,0.000,NULL,'within_tolerance'),('733d93a1-5160-4870-ad5a-6f2884a323ee','336a7f04-d119-446e-b027-52c6ce9943c2','7fecf0fb-3877-41a3-8909-59df8c6a106f','305bf8e5-81e1-4d4a-8031-02d434a561e4',2.000,1.000,1.000,1.000,0.000,NULL,'within_tolerance'),('d6c78df5-d8f2-4c78-b4f7-f10c577c734c','9693f42f-03c6-49d5-9bc0-4b7b9ed6e6c8','2d0432da-4c89-492c-a495-30f44346e611','e3d5bf55-6758-4f0e-8b67-04cbabc8c9c2',12.000,12.000,12.000,12.000,0.000,NULL,'within_tolerance'),('de364902-60fc-41bd-be0b-627d2f2c9307','2a103954-d98a-434a-a32f-a90a5863ec14','847f66f1-b1c6-4a36-990e-10b1eb519ceb','2d3fe17f-b695-4fcf-8f9e-7b540831f590',1.000,1.000,1.000,1.000,0.000,NULL,'within_tolerance'),('fc59e58c-62c7-4a1b-8bbf-0fdfa59c96cb','0775ca64-b42e-454c-ad88-786a1d1ef147','f0729f7f-dafd-4b29-9694-e179fdfb6cc8','7436ae75-6c4d-4728-ab9f-8bc8a4456184',1.000,1.000,1.000,1.000,0.000,NULL,'within_tolerance');
/*!40000 ALTER TABLE `grn_line_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `in_transit_stock`
--

DROP TABLE IF EXISTS `in_transit_stock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `in_transit_stock` (
  `id` varchar(36) NOT NULL,
  `branch_order_id` varchar(36) NOT NULL,
  `branch_order_line_id` varchar(36) NOT NULL,
  `item_master_id` varchar(36) NOT NULL,
  `from_location_id` varchar(36) NOT NULL,
  `to_location_id` varchar(36) NOT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `dispatched_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `branch_order_line_id` (`branch_order_line_id`),
  KEY `from_location_id` (`from_location_id`),
  KEY `to_location_id` (`to_location_id`),
  KEY `idx_its_order` (`branch_order_id`),
  KEY `idx_its_item` (`item_master_id`),
  CONSTRAINT `in_transit_stock_ibfk_1` FOREIGN KEY (`branch_order_id`) REFERENCES `branch_orders` (`id`),
  CONSTRAINT `in_transit_stock_ibfk_2` FOREIGN KEY (`branch_order_line_id`) REFERENCES `branch_order_line_items` (`id`),
  CONSTRAINT `in_transit_stock_ibfk_3` FOREIGN KEY (`item_master_id`) REFERENCES `item_master` (`id`),
  CONSTRAINT `in_transit_stock_ibfk_4` FOREIGN KEY (`from_location_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `in_transit_stock_ibfk_5` FOREIGN KEY (`to_location_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `in_transit_stock`
--

LOCK TABLES `in_transit_stock` WRITE;
/*!40000 ALTER TABLE `in_transit_stock` DISABLE KEYS */;
/*!40000 ALTER TABLE `in_transit_stock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `integration_dlq`
--

DROP TABLE IF EXISTS `integration_dlq`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `integration_dlq` (
  `id` varchar(36) NOT NULL,
  `integration_type` varchar(60) NOT NULL,
  `record_id` varchar(36) DEFAULT NULL,
  `payload` json DEFAULT NULL,
  `error_message` text,
  `retry_count` int NOT NULL DEFAULT '0',
  `resolved` tinyint(1) NOT NULL DEFAULT '0',
  `resolved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dlq_type` (`integration_type`),
  KEY `idx_dlq_resolved` (`resolved`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `integration_dlq`
--

LOCK TABLES `integration_dlq` WRITE;
/*!40000 ALTER TABLE `integration_dlq` DISABLE KEYS */;
/*!40000 ALTER TABLE `integration_dlq` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `integration_logs`
--

DROP TABLE IF EXISTS `integration_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `integration_logs` (
  `id` varchar(36) NOT NULL,
  `integration_type` varchar(60) NOT NULL,
  `direction` enum('outbound','inbound') NOT NULL DEFAULT 'outbound',
  `record_id` varchar(36) DEFAULT NULL,
  `request_payload` json DEFAULT NULL,
  `response_payload` json DEFAULT NULL,
  `status` enum('success','failed','retrying') NOT NULL,
  `attempt_count` int NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_int_log_type` (`integration_type`),
  KEY `idx_int_log_record` (`record_id`),
  KEY `idx_int_log_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `integration_logs`
--

LOCK TABLES `integration_logs` WRITE;
/*!40000 ALTER TABLE `integration_logs` DISABLE KEYS */;
INSERT INTO `integration_logs` VALUES ('02c621eb-9700-41e9-98ca-b8fc824e9b0e','sap_invoice_post','outbound','1612f157-db8f-45ec-9a55-f9f337ced20c','{\"asn_id\": \"a7f44c68-4338-457b-9310-d5dfd4bcef85\", \"record_id\": \"1612f157-db8f-45ec-9a55-f9f337ced20c\", \"module_name\": \"asn\", \"total_amount\": \"132000.00\", \"invoice_number\": \"INV22\"}','{\"status\": \"acknowledged\", \"sap_document_number\": \"SAP-SAP_INVOICE_POST-1782813754262\"}','success',1,'2026-06-30 10:02:34'),('0ca03d6f-5a09-42c7-8d25-55ccd439c852','sap_pr_sync','outbound','748892b4-13b1-4cc9-836f-02b4d30d04f6','{\"pr_number\": \"PR-000002\", \"record_id\": \"748892b4-13b1-4cc9-836f-02b4d30d04f6\", \"module_name\": \"pr\", \"final_status\": \"approved\", \"approved_value\": 257000}','{\"status\": \"acknowledged\", \"sap_document_number\": \"SAP-SAP_PR_SYNC-1782747097037\"}','success',1,'2026-06-29 15:31:37'),('12ce2406-388c-4dd1-98cc-8c3de5b6af09','sap_grn_post','outbound','0775ca64-b42e-454c-ad88-786a1d1ef147','{\"po_id\": \"dde4c31f-32e5-4424-b865-2e010cb83b0e\", \"asn_id\": \"7618231f-9761-473e-ac74-bdf94a3ec525\", \"record_id\": \"0775ca64-b42e-454c-ad88-786a1d1ef147\", \"grn_number\": \"GRN-000003\", \"module_name\": \"asn\"}','{\"status\": \"acknowledged\", \"sap_document_number\": \"SAP-SAP_GRN_POST-1782750163826\"}','success',1,'2026-06-29 16:22:43'),('16bdb466-0fcf-4a77-8826-0aca9c6ac225','sap_grn_post','outbound','9693f42f-03c6-49d5-9bc0-4b7b9ed6e6c8','{\"po_id\": \"da83a975-cc4c-4990-8b63-1744b2a97e75\", \"asn_id\": \"94464ca3-3361-47a9-804b-655e5ef8b8ce\", \"record_id\": \"9693f42f-03c6-49d5-9bc0-4b7b9ed6e6c8\", \"grn_number\": \"GRN-000001\", \"module_name\": \"asn\"}','{\"status\": \"acknowledged\", \"sap_document_number\": \"SAP-SAP_GRN_POST-1782719213875\"}','success',1,'2026-06-29 07:46:53'),('2096d80f-0468-469d-bd1b-4758a7f3bbdc','sap_pr_sync','outbound','01a83857-cb2b-4aa6-8194-d253e60a4704','{\"pr_number\": \"PR-000003\", \"record_id\": \"01a83857-cb2b-4aa6-8194-d253e60a4704\", \"module_name\": \"pr\", \"final_status\": \"approved\", \"approved_value\": 257000}','{\"status\": \"acknowledged\", \"sap_document_number\": \"SAP-SAP_PR_SYNC-1782808200444\"}','success',1,'2026-06-30 08:30:00'),('34153565-7bd0-4f51-9880-a63c97b26901','sap_invoice_post','outbound','821d315f-f4eb-4e33-a2e3-4f9e57b8d731','{\"asn_id\": \"0cc94639-c532-4306-aaa9-2f6f1d6eca46\", \"record_id\": \"821d315f-f4eb-4e33-a2e3-4f9e57b8d731\", \"module_name\": \"asn\", \"total_amount\": \"125000.00\", \"invoice_number\": \"INV-23-003\"}','{\"status\": \"acknowledged\", \"sap_document_number\": \"SAP-SAP_INVOICE_POST-1782748939424\"}','success',1,'2026-06-29 16:02:19'),('3ff793c3-183c-492d-9c2e-1ffc2ef61b92','sap_grn_post','outbound','ef91bdd5-abee-4601-8683-bd74a15aab0c','{\"po_id\": \"527ea671-f3f7-4e40-beac-b0213a7e872a\", \"asn_id\": \"a7f44c68-4338-457b-9310-d5dfd4bcef85\", \"record_id\": \"ef91bdd5-abee-4601-8683-bd74a15aab0c\", \"grn_number\": \"GRN-000005\", \"module_name\": \"asn\"}','{\"status\": \"acknowledged\", \"sap_document_number\": \"SAP-SAP_GRN_POST-1782813647760\"}','success',1,'2026-06-30 10:00:47'),('64287ae9-78df-49bb-8e7d-8af6c521152b','sap_pr_sync','outbound','f4f3e756-9e8e-4460-b395-3bfbedaea076','{\"pr_number\": \"PR-000001\", \"record_id\": \"f4f3e756-9e8e-4460-b395-3bfbedaea076\", \"module_name\": \"pr\", \"final_status\": \"approved\", \"approved_value\": 1542000}','{\"status\": \"acknowledged\", \"sap_document_number\": \"SAP-SAP_PR_SYNC-1782706568691\"}','success',1,'2026-06-29 04:16:08'),('7c714181-000c-40ab-8929-9a168aedcc62','sap_pr_sync','outbound','0bebe3a7-efb5-4768-a23d-a570146f118b','{\"pr_number\": \"PR-000004\", \"record_id\": \"0bebe3a7-efb5-4768-a23d-a570146f118b\", \"module_name\": \"pr\", \"final_status\": \"approved\", \"approved_value\": 128500}','{\"status\": \"acknowledged\", \"sap_document_number\": \"SAP-SAP_PR_SYNC-1782812689658\"}','success',1,'2026-06-30 09:44:49'),('a109fca3-fa01-4d0c-acda-580ad75309bc','sap_invoice_post','outbound','1072f981-47b2-448b-bb30-9ab2aef98283','{\"asn_id\": \"a1686345-6595-448b-9b6f-3fcce4f3dad1\", \"record_id\": \"1072f981-47b2-448b-bb30-9ab2aef98283\", \"module_name\": \"asn\", \"total_amount\": \"135000.00\", \"invoice_number\": \"INV-12-001\"}','{\"status\": \"acknowledged\", \"sap_document_number\": \"SAP-SAP_INVOICE_POST-1782808811996\"}','success',1,'2026-06-30 08:40:11'),('b2ece2c1-d71a-4a21-b91e-9b0cf169d163','sap_grn_post','outbound','336a7f04-d119-446e-b027-52c6ce9943c2','{\"po_id\": \"f813ab6c-948f-4e26-b850-379a8f2a1f71\", \"asn_id\": \"a1686345-6595-448b-9b6f-3fcce4f3dad1\", \"record_id\": \"336a7f04-d119-446e-b027-52c6ce9943c2\", \"grn_number\": \"GRN-000004\", \"module_name\": \"asn\"}','{\"status\": \"acknowledged\", \"sap_document_number\": \"SAP-SAP_GRN_POST-1782808800804\"}','success',1,'2026-06-30 08:40:00'),('d12ca836-5c0c-4545-aba7-e8ffaffe576c','sap_grn_post','outbound','2a103954-d98a-434a-a32f-a90a5863ec14','{\"po_id\": \"2f95fdb5-27b4-47be-8c63-433bf0bb4225\", \"asn_id\": \"0cc94639-c532-4306-aaa9-2f6f1d6eca46\", \"record_id\": \"2a103954-d98a-434a-a32f-a90a5863ec14\", \"grn_number\": \"GRN-000002\", \"module_name\": \"asn\"}','{\"status\": \"acknowledged\", \"sap_document_number\": \"SAP-SAP_GRN_POST-1782748935729\"}','success',1,'2026-06-29 16:02:15'),('f879cd55-ea2d-4a64-9d4f-6d587a4fe30d','sap_invoice_post','outbound','492d3c3d-e5ff-4ab2-b259-da43f756bd5e','{\"asn_id\": \"94464ca3-3361-47a9-804b-655e5ef8b8ce\", \"record_id\": \"492d3c3d-e5ff-4ab2-b259-da43f756bd5e\", \"module_name\": \"asn\", \"total_amount\": \"1500000.00\", \"invoice_number\": \"INV-2026-001\"}','{\"status\": \"acknowledged\", \"sap_document_number\": \"SAP-SAP_INVOICE_POST-1782719217344\"}','success',1,'2026-06-29 07:46:57');
/*!40000 ALTER TABLE `integration_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_batches`
--

DROP TABLE IF EXISTS `inventory_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_batches` (
  `id` varchar(36) NOT NULL,
  `batch_number` varchar(100) NOT NULL,
  `item_master_id` varchar(36) NOT NULL,
  `grn_id` varchar(36) NOT NULL,
  `grn_line_item_id` varchar(36) NOT NULL,
  `location_id` varchar(36) NOT NULL,
  `qty_received` decimal(15,3) NOT NULL,
  `qty_available` decimal(15,3) NOT NULL DEFAULT '0.000',
  `rate` decimal(15,2) NOT NULL DEFAULT '0.00',
  `discount_percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
  `tax_percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
  `status` enum('active','exhausted') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `batch_number` (`batch_number`),
  KEY `grn_line_item_id` (`grn_line_item_id`),
  KEY `idx_batch_item` (`item_master_id`),
  KEY `idx_batch_location` (`location_id`),
  KEY `idx_batch_grn` (`grn_id`),
  KEY `idx_batch_status` (`status`),
  CONSTRAINT `inventory_batches_ibfk_1` FOREIGN KEY (`item_master_id`) REFERENCES `item_master` (`id`),
  CONSTRAINT `inventory_batches_ibfk_2` FOREIGN KEY (`grn_id`) REFERENCES `goods_receipt_notes` (`id`),
  CONSTRAINT `inventory_batches_ibfk_3` FOREIGN KEY (`grn_line_item_id`) REFERENCES `grn_line_items` (`id`),
  CONSTRAINT `inventory_batches_ibfk_4` FOREIGN KEY (`location_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_batches`
--

LOCK TABLES `inventory_batches` WRITE;
/*!40000 ALTER TABLE `inventory_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_stock`
--

DROP TABLE IF EXISTS `inventory_stock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_stock` (
  `id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `item_master_id` varchar(36) NOT NULL,
  `quantity_on_hand` decimal(15,3) NOT NULL DEFAULT '0.000',
  `reorder_level` decimal(15,3) NOT NULL DEFAULT '0.000',
  `reorder_quantity` decimal(15,3) NOT NULL DEFAULT '0.000',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stock_warehouse_item` (`warehouse_id`,`item_master_id`),
  KEY `item_master_id` (`item_master_id`),
  CONSTRAINT `inventory_stock_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `inventory_stock_ibfk_2` FOREIGN KEY (`item_master_id`) REFERENCES `item_master` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_stock`
--

LOCK TABLES `inventory_stock` WRITE;
/*!40000 ALTER TABLE `inventory_stock` DISABLE KEYS */;
INSERT INTO `inventory_stock` VALUES ('cf96b384-598a-4d79-849a-5a8990384214','3c84cfbb-5c9c-4371-a206-a7965c0203c8','ddee55ea-1fa0-4390-bf9b-d30ebba71a4c',14.000,0.000,0.000,'2026-06-29 16:31:57');
/*!40000 ALTER TABLE `inventory_stock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoice_line_items`
--

DROP TABLE IF EXISTS `invoice_line_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_line_items` (
  `id` varchar(36) NOT NULL,
  `invoice_id` varchar(36) NOT NULL,
  `asn_line_item_id` varchar(36) NOT NULL,
  `po_line_id` varchar(36) NOT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `unit_price` decimal(15,2) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `price_deviation_pct` decimal(6,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `invoice_id` (`invoice_id`),
  KEY `asn_line_item_id` (`asn_line_item_id`),
  KEY `po_line_id` (`po_line_id`),
  CONSTRAINT `invoice_line_items_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `invoice_line_items_ibfk_2` FOREIGN KEY (`asn_line_item_id`) REFERENCES `asn_line_items` (`id`),
  CONSTRAINT `invoice_line_items_ibfk_3` FOREIGN KEY (`po_line_id`) REFERENCES `po_line_items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoice_line_items`
--

LOCK TABLES `invoice_line_items` WRITE;
/*!40000 ALTER TABLE `invoice_line_items` DISABLE KEYS */;
INSERT INTO `invoice_line_items` VALUES ('10f5fe38-703f-46f4-8c82-6b7f9a8f9b04','1612f157-db8f-45ec-9a55-f9f337ced20c','caaf458f-e3bf-4433-966e-9239e3b750b7','7f55b0c2-8d5b-48b9-a1d9-7c1ec970d8d7',1.000,120000.00,120000.00,0.00),('9e0b6fe5-cb21-4ab9-b58c-463478eba88b','821d315f-f4eb-4e33-a2e3-4f9e57b8d731','847f66f1-b1c6-4a36-990e-10b1eb519ceb','2d3fe17f-b695-4fcf-8f9e-7b540831f590',1.000,123000.00,123000.00,0.00),('dff1d0fa-22af-413f-b5f7-e8b72caab749','1072f981-47b2-448b-bb30-9ab2aef98283','7fecf0fb-3877-41a3-8909-59df8c6a106f','305bf8e5-81e1-4d4a-8031-02d434a561e4',1.000,125000.00,125000.00,0.00),('f53c335d-bb37-4019-b790-eb084ecd4054','492d3c3d-e5ff-4ab2-b259-da43f756bd5e','2d0432da-4c89-492c-a495-30f44346e611','e3d5bf55-6758-4f0e-8b67-04cbabc8c9c2',12.000,125000.00,1500000.00,0.00);
/*!40000 ALTER TABLE `invoice_line_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoices` (
  `id` varchar(36) NOT NULL,
  `invoice_number` varchar(100) NOT NULL,
  `asn_id` varchar(36) NOT NULL,
  `grn_id` varchar(36) DEFAULT NULL,
  `po_id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `invoice_date` date DEFAULT NULL,
  `currency` varchar(3) DEFAULT 'INR',
  `exchange_rate` decimal(10,4) DEFAULT '1.0000',
  `subtotal_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `cgst_amount` decimal(15,2) DEFAULT '0.00',
  `sgst_amount` decimal(15,2) DEFAULT '0.00',
  `igst_amount` decimal(15,2) DEFAULT '0.00',
  `freight_charges` decimal(15,2) DEFAULT '0.00',
  `total_amount` decimal(15,2) NOT NULL,
  `match_status` enum('pending','matched','blocked') NOT NULL DEFAULT 'pending',
  `blocked_reason` text,
  `transaction_chain_id` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_invoice_asn` (`asn_id`),
  KEY `grn_id` (`grn_id`),
  KEY `po_id` (`po_id`),
  KEY `vendor_id` (`vendor_id`),
  KEY `idx_invoice_match_status` (`match_status`),
  CONSTRAINT `invoices_ibfk_1` FOREIGN KEY (`asn_id`) REFERENCES `asns` (`id`),
  CONSTRAINT `invoices_ibfk_2` FOREIGN KEY (`grn_id`) REFERENCES `goods_receipt_notes` (`id`),
  CONSTRAINT `invoices_ibfk_3` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`),
  CONSTRAINT `invoices_ibfk_4` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoices`
--

LOCK TABLES `invoices` WRITE;
/*!40000 ALTER TABLE `invoices` DISABLE KEYS */;
INSERT INTO `invoices` VALUES ('1072f981-47b2-448b-bb30-9ab2aef98283','INV-12-001','a1686345-6595-448b-9b6f-3fcce4f3dad1','336a7f04-d119-446e-b027-52c6ce9943c2','f813ab6c-948f-4e26-b850-379a8f2a1f71','f4cd94c1-52b0-4534-911f-0712ab2ad708','2026-06-29','INR',1.0000,125000.00,1250.00,1250.00,0.00,0.00,135000.00,'matched',NULL,'01a83857-cb2b-4aa6-8194-d253e60a4704','2026-06-30 08:40:11','2026-06-30 08:40:11'),('1612f157-db8f-45ec-9a55-f9f337ced20c','INV22','a7f44c68-4338-457b-9310-d5dfd4bcef85','ef91bdd5-abee-4601-8683-bd74a15aab0c','527ea671-f3f7-4e40-beac-b0213a7e872a','f4cd94c1-52b0-4534-911f-0712ab2ad708','2026-07-01','INR',1.0000,120000.00,0.00,0.00,0.00,0.00,132000.00,'matched',NULL,'0bebe3a7-efb5-4768-a23d-a570146f118b','2026-06-30 10:02:34','2026-06-30 10:02:34'),('492d3c3d-e5ff-4ab2-b259-da43f756bd5e','INV-2026-001','94464ca3-3361-47a9-804b-655e5ef8b8ce','9693f42f-03c6-49d5-9bc0-4b7b9ed6e6c8','da83a975-cc4c-4990-8b63-1744b2a97e75','919dfc64-281f-4b7f-9b5b-0b02d75a4109','2026-06-29','INR',1.0000,1500000.00,18000.00,18000.00,0.00,120.00,1500000.00,'matched',NULL,'f4f3e756-9e8e-4460-b395-3bfbedaea076','2026-06-29 07:46:57','2026-06-29 07:46:57'),('821d315f-f4eb-4e33-a2e3-4f9e57b8d731','INV-23-003','0cc94639-c532-4306-aaa9-2f6f1d6eca46','2a103954-d98a-434a-a32f-a90a5863ec14','2f95fdb5-27b4-47be-8c63-433bf0bb4225','f4cd94c1-52b0-4534-911f-0712ab2ad708','2026-06-30','INR',1.0000,123000.00,1250.00,1250.00,0.00,0.00,125000.00,'matched',NULL,'748892b4-13b1-4cc9-836f-02b4d30d04f6','2026-06-29 16:02:19','2026-06-29 16:02:19');
/*!40000 ALTER TABLE `invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `item_company_mapping`
--

DROP TABLE IF EXISTS `item_company_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_company_mapping` (
  `id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `company_id` varchar(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_item_company` (`item_id`,`company_id`),
  KEY `idx_icm_item` (`item_id`),
  KEY `idx_icm_company` (`company_id`),
  CONSTRAINT `item_company_mapping_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `item_master` (`id`),
  CONSTRAINT `item_company_mapping_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `company_master` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item_company_mapping`
--

LOCK TABLES `item_company_mapping` WRITE;
/*!40000 ALTER TABLE `item_company_mapping` DISABLE KEYS */;
INSERT INTO `item_company_mapping` VALUES ('6da4afe0-5171-42ef-8a5c-e574be706950','ddee55ea-1fa0-4390-bf9b-d30ebba71a4c','da3debc2-03ff-4cc8-a99a-322e537020cf','2026-06-29 03:53:14');
/*!40000 ALTER TABLE `item_company_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `item_master`
--

DROP TABLE IF EXISTS `item_master`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_master` (
  `id` varchar(36) NOT NULL,
  `item_code` varchar(50) NOT NULL,
  `item_description` varchar(500) NOT NULL,
  `uom` varchar(50) DEFAULT 'Nos',
  `category` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `approval_workflow_id` varchar(36) DEFAULT NULL,
  `workflow_instance_id` varchar(36) DEFAULT NULL,
  `sla_due_date` datetime DEFAULT NULL,
  `sla_breach_flag` tinyint(1) DEFAULT '0',
  `escalation_level` int DEFAULT '0',
  `external_source` enum('API','Manual','Upload') DEFAULT 'Manual',
  `data_source_reference_id` varchar(100) DEFAULT NULL,
  `soft_delete_flag` tinyint(1) DEFAULT '0',
  `audit_log_reference_id` varchar(36) DEFAULT NULL,
  `item_name` varchar(255) DEFAULT NULL,
  `category_id` varchar(36) DEFAULT NULL,
  `subcategory_id` varchar(36) DEFAULT NULL,
  `uom_id` varchar(36) DEFAULT NULL,
  `hsn_sac_code` varchar(20) DEFAULT NULL,
  `standard_cost` decimal(15,2) DEFAULT NULL,
  `currency` varchar(3) DEFAULT 'INR',
  `specification_template` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `item_code` (`item_code`),
  KEY `idx_item_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item_master`
--

LOCK TABLES `item_master` WRITE;
/*!40000 ALTER TABLE `item_master` DISABLE KEYS */;
INSERT INTO `item_master` VALUES ('ddee55ea-1fa0-4390-bf9b-d30ebba71a4c','ITM-001','ACB Panel','Nos','Panel',1,'2026-06-29 03:53:14','2026-06-29 03:53:14',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,'ACB Panel','39be9eab-9c87-4451-8186-3ffce1d07093','3f6fd14d-f746-42b8-ace0-7aa795448f9d','7a70567f-4e99-4ece-bae3-1acaee87a5de','2345',128500.00,'INR','{\"Material\": \"Iron\"}');
/*!40000 ALTER TABLE `item_master` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `item_vendor_mapping`
--

DROP TABLE IF EXISTS `item_vendor_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_vendor_mapping` (
  `id` varchar(36) NOT NULL,
  `item_id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `is_preferred` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_item_vendor` (`item_id`,`vendor_id`),
  KEY `vendor_id` (`vendor_id`),
  CONSTRAINT `item_vendor_mapping_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `item_master` (`id`) ON DELETE CASCADE,
  CONSTRAINT `item_vendor_mapping_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item_vendor_mapping`
--

LOCK TABLES `item_vendor_mapping` WRITE;
/*!40000 ALTER TABLE `item_vendor_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `item_vendor_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `organization_master`
--

DROP TABLE IF EXISTS `organization_master`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `organization_master` (
  `id` varchar(36) NOT NULL,
  `org_code` varchar(20) NOT NULL,
  `org_name` varchar(150) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `org_code` (`org_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `organization_master`
--

LOCK TABLES `organization_master` WRITE;
/*!40000 ALTER TABLE `organization_master` DISABLE KEYS */;
INSERT INTO `organization_master` VALUES ('93f395fe-1912-4e58-a159-39ffe48bf2b3','DEFAULT','Default Organization',1,'2026-06-28 16:03:16');
/*!40000 ALTER TABLE `organization_master` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_schedule`
--

DROP TABLE IF EXISTS `payment_schedule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_schedule` (
  `id` varchar(36) NOT NULL,
  `invoice_id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `due_date` date NOT NULL,
  `scheduled_amount` decimal(15,2) NOT NULL,
  `paid_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `status` enum('pending','partial','paid','overdue') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `invoice_id` (`invoice_id`),
  KEY `idx_pay_sched_vendor` (`vendor_id`),
  KEY `idx_pay_sched_due` (`due_date`),
  KEY `idx_pay_sched_status` (`status`),
  CONSTRAINT `payment_schedule_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_schedule`
--

LOCK TABLES `payment_schedule` WRITE;
/*!40000 ALTER TABLE `payment_schedule` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_schedule` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` varchar(36) NOT NULL,
  `payment_number` varchar(50) NOT NULL,
  `payment_schedule_id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `payment_date` date NOT NULL,
  `payment_method` enum('bank_transfer','cheque','other') NOT NULL DEFAULT 'bank_transfer',
  `status` enum('processing','completed','failed','reconciled') NOT NULL DEFAULT 'processing',
  `bank_reference` varchar(100) DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payment_number` (`payment_number`),
  KEY `payment_schedule_id` (`payment_schedule_id`),
  KEY `idx_payments_vendor` (`vendor_id`),
  KEY `idx_payments_status` (`status`),
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`payment_schedule_id`) REFERENCES `payment_schedule` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `po_line_items`
--

DROP TABLE IF EXISTS `po_line_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `po_line_items` (
  `id` varchar(36) NOT NULL,
  `po_id` varchar(36) NOT NULL,
  `line_number` int NOT NULL,
  `description` varchar(500) NOT NULL,
  `hsn_sac` varchar(20) DEFAULT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `uom` varchar(20) DEFAULT NULL,
  `unit_price` decimal(15,2) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `tax_percent` decimal(5,2) DEFAULT '0.00',
  `tax_amount` decimal(15,2) DEFAULT '0.00',
  `total_line_amount` decimal(15,2) DEFAULT NULL,
  `fulfilled_quantity` decimal(15,3) DEFAULT '0.000',
  `pr_line_item_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `po_id` (`po_id`),
  CONSTRAINT `po_line_items_ibfk_1` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `po_line_items`
--

LOCK TABLES `po_line_items` WRITE;
/*!40000 ALTER TABLE `po_line_items` DISABLE KEYS */;
INSERT INTO `po_line_items` VALUES ('2d3fe17f-b695-4fcf-8f9e-7b540831f590','2f95fdb5-27b4-47be-8c63-433bf0bb4225',1,'ACB Panel',NULL,1.000,NULL,123000.00,123000.00,0.00,0.00,NULL,1.000,'95e6d8b0-4162-47e8-9840-8b5c7f18ea1f'),('305bf8e5-81e1-4d4a-8031-02d434a561e4','f813ab6c-948f-4e26-b850-379a8f2a1f71',1,'ACB Panel',NULL,2.000,NULL,125000.00,250000.00,0.00,0.00,NULL,1.000,'67b92852-1d52-4438-8c19-860f672cc1ab'),('7436ae75-6c4d-4728-ab9f-8bc8a4456184','dde4c31f-32e5-4424-b865-2e010cb83b0e',1,'ACB Panel',NULL,1.000,NULL,122000.00,122000.00,0.00,0.00,NULL,0.000,'95e6d8b0-4162-47e8-9840-8b5c7f18ea1f'),('7f55b0c2-8d5b-48b9-a1d9-7c1ec970d8d7','527ea671-f3f7-4e40-beac-b0213a7e872a',1,'ACB Panel',NULL,1.000,NULL,120000.00,120000.00,0.00,0.00,NULL,0.000,'b920a019-49a7-4c11-82fb-bed6d0cc0dc5'),('e3d5bf55-6758-4f0e-8b67-04cbabc8c9c2','da83a975-cc4c-4990-8b63-1744b2a97e75',1,'ACB Panel',NULL,12.000,NULL,125000.00,1500000.00,0.00,0.00,NULL,12.000,'28ca7735-70ba-4044-985f-354a13aacbcc');
/*!40000 ALTER TABLE `po_line_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `po_versions`
--

DROP TABLE IF EXISTS `po_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `po_versions` (
  `id` varchar(36) NOT NULL,
  `po_id` varchar(36) NOT NULL,
  `version_number` int NOT NULL,
  `change_log` json DEFAULT NULL,
  `snapshot` json NOT NULL,
  `status` enum('pending_approval','approved','rejected') NOT NULL DEFAULT 'pending_approval',
  `change_reason` text,
  `requested_by` varchar(36) DEFAULT NULL,
  `requested_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `decided_by` varchar(36) DEFAULT NULL,
  `decided_at` timestamp NULL DEFAULT NULL,
  `decision_remarks` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_po_version` (`po_id`,`version_number`),
  KEY `idx_po_versions_po` (`po_id`),
  KEY `idx_po_versions_status` (`status`),
  CONSTRAINT `po_versions_ibfk_1` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `po_versions`
--

LOCK TABLES `po_versions` WRITE;
/*!40000 ALTER TABLE `po_versions` DISABLE KEYS */;
/*!40000 ALTER TABLE `po_versions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pr_approval_rules`
--

DROP TABLE IF EXISTS `pr_approval_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pr_approval_rules` (
  `id` varchar(36) NOT NULL,
  `document_type` varchar(50) DEFAULT NULL,
  `department` varchar(255) DEFAULT NULL,
  `min_value` decimal(15,2) DEFAULT NULL,
  `max_value` decimal(15,2) DEFAULT NULL,
  `workflow_id` varchar(36) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `workflow_id` (`workflow_id`),
  CONSTRAINT `pr_approval_rules_ibfk_1` FOREIGN KEY (`workflow_id`) REFERENCES `workflow_master` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pr_approval_rules`
--

LOCK TABLES `pr_approval_rules` WRITE;
/*!40000 ALTER TABLE `pr_approval_rules` DISABLE KEYS */;
INSERT INTO `pr_approval_rules` VALUES ('788a4d6b-1fd9-42e8-b9ec-ac756c3d9979',NULL,NULL,NULL,NULL,'d5a73eed-ac84-40e5-ae3e-8eed48c651d4',1,'2026-06-28 16:07:59');
/*!40000 ALTER TABLE `pr_approval_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pr_audit_log`
--

DROP TABLE IF EXISTS `pr_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pr_audit_log` (
  `id` varchar(36) NOT NULL,
  `pr_id` varchar(36) NOT NULL,
  `action` varchar(50) NOT NULL,
  `actor_id` varchar(36) DEFAULT NULL,
  `remarks` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `pr_id` (`pr_id`),
  CONSTRAINT `pr_audit_log_ibfk_1` FOREIGN KEY (`pr_id`) REFERENCES `purchase_requisitions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pr_audit_log`
--

LOCK TABLES `pr_audit_log` WRITE;
/*!40000 ALTER TABLE `pr_audit_log` DISABLE KEYS */;
INSERT INTO `pr_audit_log` VALUES ('07e55a6c-64d1-41f8-8c2c-63af27fd2494','0bebe3a7-efb5-4768-a23d-a570146f118b','submitted','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-30 09:44:36'),('26765c92-ceb7-417f-a066-6a51ca740987','0bebe3a7-efb5-4768-a23d-a570146f118b','approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-30 09:44:49'),('29d2061a-2de7-453a-999b-4f6ddf3671ae','01a83857-cb2b-4aa6-8194-d253e60a4704','approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-30 08:30:00'),('2f8cd796-f5d0-4e1d-a557-5fdd74054fb3','0bebe3a7-efb5-4768-a23d-a570146f118b','converted_to_rfq','bf975d4b-1794-4184-aa4f-24e187b1fdc3','RFQ-000004','2026-06-30 09:46:52'),('4c453e85-66b0-432a-ba9b-bdcdcfe188bb','f4f3e756-9e8e-4460-b395-3bfbedaea076','approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-29 04:16:08'),('58217c08-75c3-4408-b9b8-97eb6ce1f2b2','748892b4-13b1-4cc9-836f-02b4d30d04f6','created','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-29 15:31:31'),('58800b38-1b98-4e36-8ea4-21db4ab749e7','f4f3e756-9e8e-4460-b395-3bfbedaea076','submitted','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-29 04:08:34'),('7d1acd29-68b9-4f3d-945b-7710156d5c93','748892b4-13b1-4cc9-836f-02b4d30d04f6','converted_to_rfq','bf975d4b-1794-4184-aa4f-24e187b1fdc3','RFQ-000002','2026-06-29 15:32:03'),('965f0f5b-07a2-4e96-b0b9-5a8a864818ec','748892b4-13b1-4cc9-836f-02b4d30d04f6','approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-29 15:31:37'),('aeb5753c-3b7f-44ef-8315-7d8a21880b6c','01a83857-cb2b-4aa6-8194-d253e60a4704','created','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-30 08:26:02'),('b0a763bf-358e-47c1-ae2a-e1d182c7bf4d','748892b4-13b1-4cc9-836f-02b4d30d04f6','submitted','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-29 15:31:31'),('c2c134eb-2463-4c32-a1d3-9bc51e4c9f25','f4f3e756-9e8e-4460-b395-3bfbedaea076','created','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-29 04:07:15'),('ced4624a-0a3a-441d-bddd-3fcac67df93a','f4f3e756-9e8e-4460-b395-3bfbedaea076','edited','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-29 04:08:34'),('d0b3c99f-7617-4cea-84fc-7c1d85eb6602','0bebe3a7-efb5-4768-a23d-a570146f118b','created','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-30 09:44:36'),('e174892f-27f5-46d2-a076-fd1c5c3d0ae4','01a83857-cb2b-4aa6-8194-d253e60a4704','submitted','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-30 08:26:02'),('ec425420-9922-4c80-ba4f-ed583372e41c','f4f3e756-9e8e-4460-b395-3bfbedaea076','converted_to_rfq','bf975d4b-1794-4184-aa4f-24e187b1fdc3','RFQ-000001','2026-06-29 04:18:16'),('f4dcdbe5-675b-4abf-b03e-e8c97d6f6197','01a83857-cb2b-4aa6-8194-d253e60a4704','converted_to_rfq','bf975d4b-1794-4184-aa4f-24e187b1fdc3','RFQ-000003','2026-06-30 08:30:40');
/*!40000 ALTER TABLE `pr_audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pr_line_items`
--

DROP TABLE IF EXISTS `pr_line_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pr_line_items` (
  `id` varchar(36) NOT NULL,
  `pr_id` varchar(36) NOT NULL,
  `sequence` int NOT NULL,
  `item_master_id` varchar(36) DEFAULT NULL,
  `description` varchar(500) NOT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `uom` varchar(50) DEFAULT 'Nos',
  `estimated_unit_price` decimal(15,2) DEFAULT NULL,
  `estimated_total_price` decimal(15,2) DEFAULT NULL,
  `delivery_date` date DEFAULT NULL,
  `delivery_location` varchar(255) DEFAULT NULL,
  `plant` varchar(100) DEFAULT NULL,
  `storage_location` varchar(100) DEFAULT NULL,
  `gr_required` tinyint(1) DEFAULT '1',
  `ir_required` tinyint(1) DEFAULT '1',
  `partial_delivery_allowed` tinyint(1) DEFAULT '1',
  `account_assignment_details` json DEFAULT NULL,
  `preferred_vendor_id` varchar(36) DEFAULT NULL,
  `consumed_quantity` decimal(15,3) DEFAULT '0.000',
  `remaining_quantity` decimal(15,3) DEFAULT NULL,
  `attachment_path` varchar(500) DEFAULT NULL,
  `attachment_name` varchar(255) DEFAULT NULL,
  `approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `requires_line_approval` tinyint(1) NOT NULL DEFAULT '0',
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejection_remarks` text,
  PRIMARY KEY (`id`),
  KEY `pr_id` (`pr_id`),
  KEY `item_master_id` (`item_master_id`),
  CONSTRAINT `pr_line_items_ibfk_1` FOREIGN KEY (`pr_id`) REFERENCES `purchase_requisitions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pr_line_items_ibfk_2` FOREIGN KEY (`item_master_id`) REFERENCES `item_master` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pr_line_items`
--

LOCK TABLES `pr_line_items` WRITE;
/*!40000 ALTER TABLE `pr_line_items` DISABLE KEYS */;
INSERT INTO `pr_line_items` VALUES ('28ca7735-70ba-4044-985f-354a13aacbcc','f4f3e756-9e8e-4460-b395-3bfbedaea076',1,'ddee55ea-1fa0-4390-bf9b-d30ebba71a4c','ACB Panel',12.000,'Nos',128500.00,1542000.00,NULL,NULL,NULL,NULL,1,1,1,NULL,NULL,12.000,0.000,NULL,NULL,'approved',0,NULL,NULL,NULL),('67b92852-1d52-4438-8c19-860f672cc1ab','01a83857-cb2b-4aa6-8194-d253e60a4704',1,'ddee55ea-1fa0-4390-bf9b-d30ebba71a4c','ACB Panel',2.000,'Nos',128500.00,257000.00,NULL,NULL,NULL,NULL,1,1,1,NULL,NULL,2.000,0.000,NULL,NULL,'approved',0,'bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-30 08:30:00',NULL),('95e6d8b0-4162-47e8-9840-8b5c7f18ea1f','748892b4-13b1-4cc9-836f-02b4d30d04f6',1,'ddee55ea-1fa0-4390-bf9b-d30ebba71a4c','ACB Panel',2.000,'Nos',128500.00,257000.00,NULL,NULL,NULL,NULL,1,1,1,NULL,NULL,2.000,0.000,NULL,NULL,'approved',0,'bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-29 15:31:37',NULL),('b920a019-49a7-4c11-82fb-bed6d0cc0dc5','0bebe3a7-efb5-4768-a23d-a570146f118b',1,'ddee55ea-1fa0-4390-bf9b-d30ebba71a4c','ACB Panel',1.000,'Nos',128500.00,128500.00,NULL,NULL,NULL,NULL,1,1,1,NULL,NULL,1.000,0.000,NULL,NULL,'approved',0,'bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-30 09:44:49',NULL);
/*!40000 ALTER TABLE `pr_line_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `price_history`
--

DROP TABLE IF EXISTS `price_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `price_history` (
  `id` varchar(36) NOT NULL,
  `item_description` varchar(500) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `po_id` varchar(36) DEFAULT NULL,
  `unit_price` decimal(15,2) NOT NULL,
  `quantity` decimal(15,3) DEFAULT NULL,
  `recorded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `item_master_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `vendor_id` (`vendor_id`),
  KEY `idx_item` (`item_description`(100)),
  KEY `idx_price_history_item_master` (`item_master_id`),
  CONSTRAINT `price_history_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `price_history`
--

LOCK TABLES `price_history` WRITE;
/*!40000 ALTER TABLE `price_history` DISABLE KEYS */;
INSERT INTO `price_history` VALUES ('0dee7f47-5677-48f4-8fd7-efde4a6b46cb','Cable Tray 300mm','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,464.00,13.000,'2026-07-02 12:33:36',NULL),('1051a658-1793-49e9-82e3-93c8456a1964','MCB 32A','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,98.00,33.000,'2026-07-02 12:33:36',NULL),('18d03ae6-d20d-4846-9c9a-e39110f7047a','MCB 32A','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,99.00,70.000,'2026-07-02 12:33:36',NULL),('22e302e3-5371-4dc6-ba0a-5979729b2096','Hydraulic Pump','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,29406.00,42.000,'2026-07-02 12:33:36',NULL),('2932a802-bcde-4da1-9cb6-470279837fc1','Steel Plate 10mm','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,1488.00,24.000,'2026-07-02 12:33:36',NULL),('402b3d10-087a-46b8-9452-c052016c59b0','Hydraulic Pump','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,31282.00,36.000,'2026-07-02 12:33:36',NULL),('46288b36-301b-4f75-913b-f65cfeffc0b9','ACB Panel','919dfc64-281f-4b7f-9b5b-0b02d75a4109','dde4c31f-32e5-4424-b865-2e010cb83b0e',122000.00,1.000,'2026-06-29 15:53:25','ddee55ea-1fa0-4390-bf9b-d30ebba71a4c'),('5295b9f6-5933-47ef-9c0f-5b783261c120','Cable Tray 300mm','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,485.00,16.000,'2026-07-02 12:33:36',NULL),('559265e6-bc21-4348-b359-8cfdcd593ee5','MCB 32A','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,97.00,26.000,'2026-07-02 12:33:36',NULL),('5b31ca76-476d-4294-88eb-e6a4bf8eefa9','Hydraulic Pump','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,29477.00,36.000,'2026-07-02 12:33:36',NULL),('67bc02c6-4889-406b-a285-4a21da9680e0','Cable Tray 300mm','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,492.00,52.000,'2026-07-02 12:33:36',NULL),('6dc64bf1-fb6a-4469-9b85-75e70630d317','ACB Panel','f4cd94c1-52b0-4534-911f-0712ab2ad708','f813ab6c-948f-4e26-b850-379a8f2a1f71',125000.00,2.000,'2026-06-30 08:37:03','ddee55ea-1fa0-4390-bf9b-d30ebba71a4c'),('837c2d0f-506a-41c0-9e9f-a21df01bcae5','Steel Plate 10mm','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,1582.00,15.000,'2026-07-02 12:33:36',NULL),('8e7c8b61-643f-4776-b07d-14a12b044f70','Hydraulic Pump','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,30663.00,51.000,'2026-07-02 12:33:36',NULL),('902e08ad-b717-4255-86e2-ad302b0ecdb9','ACB Panel','f4cd94c1-52b0-4534-911f-0712ab2ad708','527ea671-f3f7-4e40-beac-b0213a7e872a',120000.00,1.000,'2026-06-30 09:53:59','ddee55ea-1fa0-4390-bf9b-d30ebba71a4c'),('99b42655-df3a-4ce2-8f2f-d98bf6fa4373','Steel Plate 10mm','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,1445.00,60.000,'2026-07-02 12:33:36',NULL),('a700238e-c3f2-4507-b16f-f6e1c6a7fa7f','Hydraulic Pump','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,32713.00,13.000,'2026-07-02 12:33:36',NULL),('ad9affab-4374-4bca-9d4e-f19d6d6c15e5','Cable Tray 300mm','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,521.00,59.000,'2026-07-02 12:33:36',NULL),('b6683bbe-d24a-4279-b7b1-397b5927271d','MCB 32A','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,92.00,54.000,'2026-07-02 12:33:36',NULL),('b863ba11-35ec-4071-934b-52802b3859ef','Steel Plate 10mm','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,1426.00,93.000,'2026-07-02 12:33:36',NULL),('bc6729d7-480d-4c51-8c0c-7c52ff149a68','ACB Panel 630A','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,1210.00,22.000,'2026-07-02 12:33:36',NULL),('be729e3f-495c-4467-a41f-ed209996c8d0','MCB 32A','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,87.00,66.000,'2026-07-02 12:33:36',NULL),('bf3826d8-1629-4a37-baf4-e4b27e312a5d','ACB Panel 630A','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,1288.00,106.000,'2026-07-02 12:33:36',NULL),('c4d831d0-ebc6-4d44-a9e1-440e7ee4b7e9','ACB Panel 630A','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,1276.00,49.000,'2026-07-02 12:33:36',NULL),('d0e8471d-c420-4e39-9344-6b1416160649','ACB Panel 630A','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,1299.00,36.000,'2026-07-02 12:33:36',NULL),('d3bcf0cd-cfa8-427c-a569-2fd3a217aff1','Steel Plate 10mm','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,1562.00,32.000,'2026-07-02 12:33:36',NULL),('da47004b-a091-46f6-8a9c-a255d25d8646','Steel Plate 10mm','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,1582.00,14.000,'2026-07-02 12:33:36',NULL),('dc1ecb13-6ad6-49d9-ab7f-b59775d75e28','ACB Panel 630A','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,1338.00,31.000,'2026-07-02 12:33:36',NULL),('e26adcc4-c35d-49ad-960c-2f3822268bed','ACB Panel 630A','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,1364.00,26.000,'2026-07-02 12:33:36',NULL),('e2aaa42e-12df-4df6-af37-334533373574','ACB Panel','f4cd94c1-52b0-4534-911f-0712ab2ad708','2f95fdb5-27b4-47be-8c63-433bf0bb4225',123000.00,1.000,'2026-06-29 15:53:25','ddee55ea-1fa0-4390-bf9b-d30ebba71a4c'),('e480d4d2-b6c5-4ec8-a9b5-d94d1b0ff7ee','ACB Panel','919dfc64-281f-4b7f-9b5b-0b02d75a4109','da83a975-cc4c-4990-8b63-1744b2a97e75',125000.00,12.000,'2026-06-29 07:13:58','ddee55ea-1fa0-4390-bf9b-d30ebba71a4c'),('e8697cb8-1d48-4a68-aa68-78aac368dc32','MCB 32A','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,93.00,98.000,'2026-07-02 12:33:36',NULL),('e9cbe2b9-64ec-4084-bbdf-585769bd2991','Cable Tray 300mm','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,490.00,54.000,'2026-07-02 12:33:36',NULL),('f151616e-5021-48c7-9ed1-fd6b3cfaff91','Hydraulic Pump','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,32187.00,65.000,'2026-07-02 12:33:36',NULL),('fdde5518-a81f-4b6a-bd1e-575bc44da246','Cable Tray 300mm','919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,482.00,76.000,'2026-07-02 12:33:36',NULL);
/*!40000 ALTER TABLE `price_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `procurement_exceptions`
--

DROP TABLE IF EXISTS `procurement_exceptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `procurement_exceptions` (
  `id` varchar(36) NOT NULL,
  `exception_type` enum('budget_breach','price_mismatch','quantity_mismatch','vendor_risk','compliance_expiry','grn_tolerance_breach','invoice_mismatch','sla_breach') NOT NULL,
  `severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `status` enum('open','resolved') NOT NULL DEFAULT 'open',
  `module_name` enum('purchase_requisition','purchase_order','asn','vendor') NOT NULL,
  `record_id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) DEFAULT NULL,
  `transaction_chain_id` varchar(36) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `metadata` json DEFAULT NULL,
  `dedup_key` varchar(150) NOT NULL,
  `detected_by` enum('system','manual') NOT NULL DEFAULT 'system',
  `created_by` varchar(36) DEFAULT NULL,
  `resolved_by` varchar(36) DEFAULT NULL,
  `resolution_remarks` text,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_exc_status` (`status`),
  KEY `idx_exc_type` (`exception_type`),
  KEY `idx_exc_module_record` (`module_name`,`record_id`),
  KEY `idx_exc_vendor` (`vendor_id`),
  KEY `idx_exc_chain` (`transaction_chain_id`),
  KEY `idx_exc_dedup` (`dedup_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `procurement_exceptions`
--

LOCK TABLES `procurement_exceptions` WRITE;
/*!40000 ALTER TABLE `procurement_exceptions` DISABLE KEYS */;
INSERT INTO `procurement_exceptions` VALUES ('1efc1ed4-ebc5-4bb6-9bfa-aa5ac4b8741c','price_mismatch','medium','open','purchase_order','55ee0ab0-5798-44ac-bca2-438a80ca20d1',NULL,NULL,'Invoice exceeds PO price','PO-000004 line 2: Invoice 1450 vs PO 1250 (+16%)',NULL,'price:po4:line2','system',NULL,NULL,NULL,NULL,'2026-07-02 12:31:22','2026-07-02 12:31:22'),('421c0b51-d12c-40e3-888a-448c54bb7533','invoice_mismatch','critical','open','asn','adc74c8b-791c-4a49-988b-eb6d3e086495',NULL,NULL,'3-way match failed INV-000005','Billed 18.5L vs PO 15L (23.3%)',NULL,'inv:match:inv5','system',NULL,NULL,NULL,NULL,'2026-07-02 12:32:48','2026-07-02 12:32:48'),('58d8adad-f577-4c27-a898-b3d3818278b2','budget_breach','high','open','purchase_requisition','adc74c8b-791c-4a49-988b-eb6d3e086495',NULL,NULL,'Budget exceeded for Operations','PR value exceeds remaining budget for CC-001',NULL,'budget:cc001:pr3','system',NULL,NULL,NULL,NULL,'2026-07-02 12:32:48','2026-07-02 12:32:48'),('682f368b-acfc-4698-9f06-e527e8208e63','compliance_expiry','medium','open','vendor','adc74c8b-791c-4a49-988b-eb6d3e086495',NULL,NULL,'GST certificate expiring - Siemens','Expires in 15 days',NULL,'comp:siemens:gst','system',NULL,NULL,NULL,NULL,'2026-07-02 12:32:48','2026-07-02 12:32:48'),('6efe0815-a0fb-4662-8499-197834065698','grn_tolerance_breach','critical','open','asn','55ee0ab0-5798-44ac-bca2-438a80ca20d1',NULL,NULL,'GRN qty mismatch ASN-MQYWN153','ACB Panel: received 10 vs shipped 12 (-16.7%)',NULL,'grn:acb:asn153','system',NULL,NULL,NULL,NULL,'2026-07-02 12:31:22','2026-07-02 12:31:22'),('7216288b-77c4-4b00-928b-f3b7a4f39109','quantity_mismatch','low','open','asn','adc74c8b-791c-4a49-988b-eb6d3e086495',NULL,NULL,'Partial shipment - Cable Trays','8 of 12 delivered, 4 pending',NULL,'qty:asn:cable','system',NULL,NULL,NULL,NULL,'2026-07-02 12:32:48','2026-07-02 12:32:48'),('87dc2e08-52a8-49f0-91be-07117b708777','quantity_mismatch','low','open','asn','55ee0ab0-5798-44ac-bca2-438a80ca20d1',NULL,NULL,'Partial shipment - Cable Trays','8 of 12 delivered, 4 pending',NULL,'qty:asn:cable','system',NULL,NULL,NULL,NULL,'2026-07-02 12:31:22','2026-07-02 12:31:22'),('a2e4ef1a-b978-4c40-9412-8b53a8513d0e','vendor_risk','high','open','vendor','55ee0ab0-5798-44ac-bca2-438a80ca20d1',NULL,NULL,'Vendor risk elevated - L&T','Risk score 35% due to 2 delivery delays',NULL,'risk:lnt:2026q3','system',NULL,NULL,NULL,NULL,'2026-07-02 12:31:22','2026-07-02 12:31:22'),('b9732c0a-ae9e-4a57-9fc7-5c9e037af61d','budget_breach','high','open','purchase_requisition','55ee0ab0-5798-44ac-bca2-438a80ca20d1',NULL,NULL,'Budget exceeded for Operations','PR value exceeds remaining budget for CC-001',NULL,'budget:cc001:pr3','system',NULL,NULL,NULL,NULL,'2026-07-02 12:31:22','2026-07-02 12:31:22'),('c729cf97-6ca0-4461-b3c0-015333c6f07a','sla_breach','high','open','purchase_requisition','55ee0ab0-5798-44ac-bca2-438a80ca20d1',NULL,NULL,'Approval SLA breached PR-000004','Pending 72h (SLA: 24h)',NULL,'sla:pr4','system',NULL,NULL,NULL,NULL,'2026-07-02 12:31:22','2026-07-02 12:31:22'),('d17e7753-ac15-44dd-bf3e-6e16649cd568','sla_breach','high','open','purchase_requisition','adc74c8b-791c-4a49-988b-eb6d3e086495',NULL,NULL,'Approval SLA breached PR-000004','Pending 72h (SLA: 24h)',NULL,'sla:pr4','system',NULL,NULL,NULL,NULL,'2026-07-02 12:32:48','2026-07-02 12:32:48'),('d73e4705-efc2-40d2-8acd-9fa26566f616','vendor_risk','high','open','vendor','adc74c8b-791c-4a49-988b-eb6d3e086495',NULL,NULL,'Vendor risk elevated - L&T','Risk score 35% due to 2 delivery delays',NULL,'risk:lnt:2026q3','system',NULL,NULL,NULL,NULL,'2026-07-02 12:32:48','2026-07-02 12:32:48'),('dc173456-a899-4479-ad3c-74889ad5c3f1','grn_tolerance_breach','critical','open','asn','adc74c8b-791c-4a49-988b-eb6d3e086495',NULL,NULL,'GRN qty mismatch ASN-MQYWN153','ACB Panel: received 10 vs shipped 12 (-16.7%)',NULL,'grn:acb:asn153','system',NULL,NULL,NULL,NULL,'2026-07-02 12:32:48','2026-07-02 12:32:48'),('e1177e9e-b5da-456c-90a0-1031ce6a1eee','price_mismatch','medium','open','purchase_order','adc74c8b-791c-4a49-988b-eb6d3e086495',NULL,NULL,'Invoice exceeds PO price','PO-000004 line 2: Invoice 1450 vs PO 1250 (+16%)',NULL,'price:po4:line2','system',NULL,NULL,NULL,NULL,'2026-07-02 12:32:48','2026-07-02 12:32:48'),('f333fe4c-fdcb-4c9f-92db-845cdd16522b','compliance_expiry','medium','open','vendor','55ee0ab0-5798-44ac-bca2-438a80ca20d1',NULL,NULL,'GST certificate expiring - Siemens','Expires in 15 days',NULL,'comp:siemens:gst','system',NULL,NULL,NULL,NULL,'2026-07-02 12:31:22','2026-07-02 12:31:22');
/*!40000 ALTER TABLE `procurement_exceptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_orders`
--

DROP TABLE IF EXISTS `purchase_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_orders` (
  `id` varchar(36) NOT NULL,
  `po_number` varchar(50) NOT NULL,
  `po_date` date DEFAULT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `buyer_name` varchar(255) DEFAULT NULL,
  `buyer_address` text,
  `gstin` varchar(15) DEFAULT NULL,
  `state_name` varchar(100) DEFAULT NULL,
  `state_code` varchar(10) DEFAULT NULL,
  `total_amount` decimal(15,2) NOT NULL,
  `terms_of_payment` varchar(255) DEFAULT NULL,
  `validity_date` date DEFAULT NULL,
  `status` enum('open','partially_fulfilled','fulfilled','closed') DEFAULT 'open',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `approval_workflow_id` varchar(36) DEFAULT NULL,
  `workflow_instance_id` varchar(36) DEFAULT NULL,
  `sla_due_date` datetime DEFAULT NULL,
  `sla_breach_flag` tinyint(1) DEFAULT '0',
  `escalation_level` int DEFAULT '0',
  `external_source` enum('API','Manual','Upload') DEFAULT 'Manual',
  `data_source_reference_id` varchar(100) DEFAULT NULL,
  `soft_delete_flag` tinyint(1) DEFAULT '0',
  `audit_log_reference_id` varchar(36) DEFAULT NULL,
  `contract_id` varchar(36) DEFAULT NULL,
  `incoterms` varchar(20) DEFAULT NULL,
  `cost_center` varchar(100) DEFAULT NULL,
  `project_code` varchar(100) DEFAULT NULL,
  `budget_code` varchar(100) DEFAULT NULL,
  `delivery_schedule_json` json DEFAULT NULL,
  `partial_delivery_allowed_flag` tinyint(1) DEFAULT '1',
  `retention_percentage` decimal(5,2) DEFAULT NULL,
  `pr_id` varchar(36) DEFAULT NULL,
  `department` varchar(255) DEFAULT NULL,
  `account_assignment_category` varchar(50) DEFAULT NULL,
  `account_assignment_details` json DEFAULT NULL,
  `company_code` varchar(50) DEFAULT NULL,
  `plant` varchar(100) DEFAULT NULL,
  `requester_id` varchar(36) DEFAULT NULL,
  `rfq_id` varchar(36) DEFAULT NULL,
  `transaction_chain_id` varchar(36) DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1',
  `amendment_status` enum('none','pending_approval') NOT NULL DEFAULT 'none',
  `organization_id` varchar(36) DEFAULT NULL,
  `company_id` varchar(36) DEFAULT NULL,
  `business_unit_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `po_number` (`po_number`),
  KEY `idx_vendor` (`vendor_id`),
  KEY `idx_purchase_orders_chain` (`transaction_chain_id`),
  CONSTRAINT `purchase_orders_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_orders`
--

LOCK TABLES `purchase_orders` WRITE;
/*!40000 ALTER TABLE `purchase_orders` DISABLE KEYS */;
INSERT INTO `purchase_orders` VALUES ('2f95fdb5-27b4-47be-8c63-433bf0bb4225','PO-000003',NULL,'f4cd94c1-52b0-4534-911f-0712ab2ad708',NULL,NULL,NULL,NULL,NULL,123000.00,NULL,NULL,'fulfilled','2026-06-29 15:53:25','2026-06-29 16:02:22',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,'748892b4-13b1-4cc9-836f-02b4d30d04f6','Finance','Cost Center',NULL,NULL,'PLANT-02','bf975d4b-1794-4184-aa4f-24e187b1fdc3','9ec86c4d-1baf-4f66-9548-4409e8cf6099','748892b4-13b1-4cc9-836f-02b4d30d04f6',1,'none',NULL,NULL,NULL),('527ea671-f3f7-4e40-beac-b0213a7e872a','PO-000005',NULL,'f4cd94c1-52b0-4534-911f-0712ab2ad708',NULL,NULL,NULL,NULL,NULL,120000.00,NULL,NULL,'open','2026-06-30 09:53:59','2026-06-30 09:53:59',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,'0bebe3a7-efb5-4768-a23d-a570146f118b','Finance','Cost Center',NULL,NULL,'PLANT-01','bf975d4b-1794-4184-aa4f-24e187b1fdc3','f3eca309-d00b-4aba-9b35-c2c0423adfcd','0bebe3a7-efb5-4768-a23d-a570146f118b',1,'none',NULL,NULL,NULL),('da83a975-cc4c-4990-8b63-1744b2a97e75','PO-000001',NULL,'919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,NULL,NULL,NULL,NULL,1500000.00,NULL,NULL,'fulfilled','2026-06-29 07:13:58','2026-06-29 07:47:28',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,'f4f3e756-9e8e-4460-b395-3bfbedaea076','Operations','Cost Center',NULL,NULL,'PLANT-01','bf975d4b-1794-4184-aa4f-24e187b1fdc3','3f1d4b3a-340a-44d2-b0a9-286eb45a43de','f4f3e756-9e8e-4460-b395-3bfbedaea076',1,'none',NULL,NULL,NULL),('dde4c31f-32e5-4424-b865-2e010cb83b0e','PO-000002',NULL,'919dfc64-281f-4b7f-9b5b-0b02d75a4109',NULL,NULL,NULL,NULL,NULL,122000.00,NULL,NULL,'open','2026-06-29 15:53:25','2026-06-29 15:53:25',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,'748892b4-13b1-4cc9-836f-02b4d30d04f6','Finance','Cost Center',NULL,NULL,'PLANT-02','bf975d4b-1794-4184-aa4f-24e187b1fdc3','9ec86c4d-1baf-4f66-9548-4409e8cf6099','748892b4-13b1-4cc9-836f-02b4d30d04f6',1,'none',NULL,NULL,NULL),('f813ab6c-948f-4e26-b850-379a8f2a1f71','PO-000004',NULL,'f4cd94c1-52b0-4534-911f-0712ab2ad708',NULL,NULL,NULL,NULL,NULL,250000.00,NULL,NULL,'partially_fulfilled','2026-06-30 08:37:03','2026-06-30 08:40:13',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,'01a83857-cb2b-4aa6-8194-d253e60a4704','Logistics','Cost Center',NULL,NULL,'PLANT-01','bf975d4b-1794-4184-aa4f-24e187b1fdc3','308000f4-37d2-4784-a643-83b8905bff17','01a83857-cb2b-4aa6-8194-d253e60a4704',1,'none',NULL,NULL,NULL);
/*!40000 ALTER TABLE `purchase_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_requisitions`
--

DROP TABLE IF EXISTS `purchase_requisitions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_requisitions` (
  `id` varchar(36) NOT NULL,
  `pr_number` varchar(50) NOT NULL,
  `document_type` varchar(50) DEFAULT 'Standard',
  `company_code` varchar(50) DEFAULT NULL,
  `plant` varchar(100) DEFAULT NULL,
  `department` varchar(255) NOT NULL,
  `requester_id` varchar(36) NOT NULL,
  `cost_center` varchar(100) DEFAULT NULL,
  `project_code` varchar(100) DEFAULT NULL,
  `account_assignment_category` varchar(50) DEFAULT 'Cost Center',
  `currency` varchar(3) DEFAULT 'INR',
  `required_date` date DEFAULT NULL,
  `priority` varchar(20) DEFAULT 'Medium',
  `justification` text NOT NULL,
  `sourcing_strategy` enum('RFQ_REQUIRED','DIRECT_PO_ALLOWED','AUTO_PO','CONTRACT_BASED') DEFAULT 'RFQ_REQUIRED',
  `preferred_vendor_id` varchar(36) DEFAULT NULL,
  `contract_id` varchar(36) DEFAULT NULL,
  `status` enum('draft','submitted','approved','partially_approved','sourcing','closed','rejected') DEFAULT 'draft',
  `total_value` decimal(15,2) DEFAULT '0.00',
  `budget_status` enum('within_budget','exceeds_budget','not_configured') DEFAULT 'not_configured',
  `rejection_reason` text,
  `approval_workflow_id` varchar(36) DEFAULT NULL,
  `workflow_instance_id` varchar(36) DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `transaction_chain_id` varchar(36) DEFAULT NULL,
  `organization_id` varchar(36) DEFAULT NULL,
  `company_id` varchar(36) DEFAULT NULL,
  `business_unit_id` varchar(36) DEFAULT NULL,
  `closure_reason` text,
  `closed_by` varchar(36) DEFAULT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pr_number` (`pr_number`),
  KEY `preferred_vendor_id` (`preferred_vendor_id`),
  KEY `contract_id` (`contract_id`),
  KEY `idx_pr_status` (`status`),
  KEY `idx_pr_department` (`department`),
  KEY `idx_pr_created_by` (`created_by`),
  KEY `idx_purchase_requisitions_chain` (`transaction_chain_id`),
  CONSTRAINT `purchase_requisitions_ibfk_1` FOREIGN KEY (`preferred_vendor_id`) REFERENCES `vendors` (`id`),
  CONSTRAINT `purchase_requisitions_ibfk_2` FOREIGN KEY (`contract_id`) REFERENCES `contracts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_requisitions`
--

LOCK TABLES `purchase_requisitions` WRITE;
/*!40000 ALTER TABLE `purchase_requisitions` DISABLE KEYS */;
INSERT INTO `purchase_requisitions` VALUES ('01a83857-cb2b-4aa6-8194-d253e60a4704','PR-000003','Standard',NULL,'PLANT-01','Logistics','bf975d4b-1794-4184-aa4f-24e187b1fdc3','CC-001','ch','Cost Center','INR','2026-07-01','Medium','checking','RFQ_REQUIRED','f4cd94c1-52b0-4534-911f-0712ab2ad708','b0fb70d1-0f85-4848-9b51-15451f548470','closed',257000.00,'within_budget',NULL,'d5a73eed-ac84-40e5-ae3e-8eed48c651d4','5fe1aab7-1b4a-47e7-a385-73b769a8557d',NULL,'2026-06-30 08:26:02','2026-06-30 08:30:40','01a83857-cb2b-4aa6-8194-d253e60a4704',NULL,'da3debc2-03ff-4cc8-a99a-322e537020cf',NULL,NULL,NULL,NULL),('0bebe3a7-efb5-4768-a23d-a570146f118b','PR-000004','Standard',NULL,'PLANT-01','Finance','bf975d4b-1794-4184-aa4f-24e187b1fdc3','CC-001','cch','Cost Center','INR','2026-07-01','Medium','sample','RFQ_REQUIRED','919dfc64-281f-4b7f-9b5b-0b02d75a4109','b0fb70d1-0f85-4848-9b51-15451f548470','closed',128500.00,'within_budget',NULL,'d5a73eed-ac84-40e5-ae3e-8eed48c651d4','74a0125f-c662-4f36-bfe9-18dcb2b17ea5',NULL,'2026-06-30 09:44:36','2026-06-30 09:46:52','0bebe3a7-efb5-4768-a23d-a570146f118b',NULL,'da3debc2-03ff-4cc8-a99a-322e537020cf',NULL,NULL,NULL,NULL),('748892b4-13b1-4cc9-836f-02b4d30d04f6','PR-000002','Standard',NULL,'PLANT-02','Finance','bf975d4b-1794-4184-aa4f-24e187b1fdc3','CC-001','ch','Cost Center','INR','2026-06-30','Medium','immediate need','RFQ_REQUIRED','919dfc64-281f-4b7f-9b5b-0b02d75a4109','b0fb70d1-0f85-4848-9b51-15451f548470','closed',257000.00,'within_budget',NULL,'d5a73eed-ac84-40e5-ae3e-8eed48c651d4','6047fdc5-d1dd-4fb4-9ec4-2bfe0879dea3',NULL,'2026-06-29 15:31:31','2026-06-29 15:32:03','748892b4-13b1-4cc9-836f-02b4d30d04f6',NULL,'da3debc2-03ff-4cc8-a99a-322e537020cf',NULL,NULL,NULL,NULL),('f4f3e756-9e8e-4460-b395-3bfbedaea076','PR-000001','Standard',NULL,'PLANT-01','Operations','bf975d4b-1794-4184-aa4f-24e187b1fdc3','CC-001','ch','Cost Center','INR','2026-06-30','Medium','check','RFQ_REQUIRED','f4cd94c1-52b0-4534-911f-0712ab2ad708','bbb2a865-985d-4775-a8fa-e30f9b5db0eb','closed',1542000.00,'within_budget',NULL,'d5a73eed-ac84-40e5-ae3e-8eed48c651d4','2614eb9c-ded3-4503-b016-905d63c186a3',NULL,'2026-06-29 04:07:15','2026-06-29 04:18:16','f4f3e756-9e8e-4460-b395-3bfbedaea076',NULL,'da3debc2-03ff-4cc8-a99a-322e537020cf',NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `purchase_requisitions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_return_line_items`
--

DROP TABLE IF EXISTS `purchase_return_line_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_return_line_items` (
  `id` varchar(36) NOT NULL,
  `purchase_return_id` varchar(36) NOT NULL,
  `item_master_id` varchar(36) NOT NULL,
  `batch_id` varchar(36) NOT NULL,
  `batch_number` varchar(100) NOT NULL,
  `location_id` varchar(36) NOT NULL,
  `return_quantity` decimal(15,3) NOT NULL,
  `rate` decimal(15,2) NOT NULL,
  `discount_percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
  `tax_percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
  `line_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `item_master_id` (`item_master_id`),
  KEY `location_id` (`location_id`),
  KEY `idx_prli_return` (`purchase_return_id`),
  KEY `idx_prli_batch` (`batch_id`),
  CONSTRAINT `purchase_return_line_items_ibfk_1` FOREIGN KEY (`purchase_return_id`) REFERENCES `purchase_returns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `purchase_return_line_items_ibfk_2` FOREIGN KEY (`item_master_id`) REFERENCES `item_master` (`id`),
  CONSTRAINT `purchase_return_line_items_ibfk_3` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches` (`id`),
  CONSTRAINT `purchase_return_line_items_ibfk_4` FOREIGN KEY (`location_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_return_line_items`
--

LOCK TABLES `purchase_return_line_items` WRITE;
/*!40000 ALTER TABLE `purchase_return_line_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_return_line_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_returns`
--

DROP TABLE IF EXISTS `purchase_returns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_returns` (
  `id` varchar(36) NOT NULL,
  `return_number` varchar(50) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `grn_id` varchar(36) NOT NULL,
  `asn_number` varchar(50) DEFAULT NULL,
  `return_date` date NOT NULL,
  `return_reason` text NOT NULL,
  `status` enum('draft','confirmed','closed') NOT NULL DEFAULT 'draft',
  `round_off` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `created_by` varchar(36) DEFAULT NULL,
  `confirmed_by` varchar(36) DEFAULT NULL,
  `confirmed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `return_number` (`return_number`),
  KEY `grn_id` (`grn_id`),
  KEY `idx_pr_vendor` (`vendor_id`),
  KEY `idx_pr_status` (`status`),
  KEY `idx_pr_date` (`return_date`),
  CONSTRAINT `purchase_returns_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`),
  CONSTRAINT `purchase_returns_ibfk_2` FOREIGN KEY (`grn_id`) REFERENCES `goods_receipt_notes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_returns`
--

LOCK TABLES `purchase_returns` WRITE;
/*!40000 ALTER TABLE `purchase_returns` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_returns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rfq_line_items`
--

DROP TABLE IF EXISTS `rfq_line_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rfq_line_items` (
  `id` varchar(36) NOT NULL,
  `rfq_id` varchar(36) NOT NULL,
  `item_description` varchar(500) NOT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `uom` varchar(50) DEFAULT 'Nos',
  `target_price` decimal(15,2) DEFAULT NULL,
  `sequence` int NOT NULL,
  `item_master_id` varchar(36) DEFAULT NULL,
  `remarks` text,
  `attachment_path` varchar(500) DEFAULT NULL,
  `attachment_name` varchar(255) DEFAULT NULL,
  `technical_specifications` json DEFAULT NULL,
  `delivery_location_id` varchar(36) DEFAULT NULL,
  `required_delivery_date` date DEFAULT NULL,
  `pr_line_item_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `rfq_id` (`rfq_id`),
  CONSTRAINT `rfq_line_items_ibfk_1` FOREIGN KEY (`rfq_id`) REFERENCES `rfqs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rfq_line_items`
--

LOCK TABLES `rfq_line_items` WRITE;
/*!40000 ALTER TABLE `rfq_line_items` DISABLE KEYS */;
INSERT INTO `rfq_line_items` VALUES ('04cb4d79-38ae-4477-8c9d-907f5f13640f','9ec86c4d-1baf-4f66-9548-4409e8cf6099','ACB Panel',2.000,'Nos',128500.00,1,'ddee55ea-1fa0-4390-bf9b-d30ebba71a4c',NULL,NULL,NULL,NULL,NULL,NULL,'95e6d8b0-4162-47e8-9840-8b5c7f18ea1f'),('4a477d88-fb4e-439e-89d3-8bba5161851e','f3eca309-d00b-4aba-9b35-c2c0423adfcd','ACB Panel',1.000,'Nos',128500.00,1,'ddee55ea-1fa0-4390-bf9b-d30ebba71a4c',NULL,NULL,NULL,NULL,NULL,NULL,'b920a019-49a7-4c11-82fb-bed6d0cc0dc5'),('5a852a01-1a02-4fc0-9021-d6397e233aef','308000f4-37d2-4784-a643-83b8905bff17','ACB Panel',2.000,'Nos',128500.00,1,'ddee55ea-1fa0-4390-bf9b-d30ebba71a4c',NULL,NULL,NULL,NULL,NULL,NULL,'67b92852-1d52-4438-8c19-860f672cc1ab'),('9e86d0f8-5a12-42d7-a903-22a4833be4f8','3f1d4b3a-340a-44d2-b0a9-286eb45a43de','ACB Panel',12.000,'Nos',128500.00,1,'ddee55ea-1fa0-4390-bf9b-d30ebba71a4c',NULL,NULL,NULL,NULL,NULL,NULL,'28ca7735-70ba-4044-985f-354a13aacbcc');
/*!40000 ALTER TABLE `rfq_line_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rfq_vendors`
--

DROP TABLE IF EXISTS `rfq_vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rfq_vendors` (
  `id` varchar(36) NOT NULL,
  `rfq_id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `participation_status` enum('invited','submitted','not_responded') DEFAULT 'invited',
  `invited_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rfq_vendor` (`rfq_id`,`vendor_id`),
  KEY `vendor_id` (`vendor_id`),
  CONSTRAINT `rfq_vendors_ibfk_1` FOREIGN KEY (`rfq_id`) REFERENCES `rfqs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rfq_vendors_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rfq_vendors`
--

LOCK TABLES `rfq_vendors` WRITE;
/*!40000 ALTER TABLE `rfq_vendors` DISABLE KEYS */;
INSERT INTO `rfq_vendors` VALUES ('08fc3059-6c81-4ddd-80ad-40ce783a7a3b','f3eca309-d00b-4aba-9b35-c2c0423adfcd','f4cd94c1-52b0-4534-911f-0712ab2ad708','submitted','2026-06-30 09:46:52'),('64c8dd45-3064-49f7-9448-49d5645fdc17','3f1d4b3a-340a-44d2-b0a9-286eb45a43de','919dfc64-281f-4b7f-9b5b-0b02d75a4109','submitted','2026-06-29 07:01:09'),('79bd7cc4-cb4b-46a6-b462-eaa4e18691d2','9ec86c4d-1baf-4f66-9548-4409e8cf6099','919dfc64-281f-4b7f-9b5b-0b02d75a4109','submitted','2026-06-29 15:32:03'),('84d276f3-35f8-4505-a357-b1c9356695ce','308000f4-37d2-4784-a643-83b8905bff17','919dfc64-281f-4b7f-9b5b-0b02d75a4109','submitted','2026-06-30 08:30:40'),('96000ff6-4b0f-403b-85c2-a292a8a1f1cc','9ec86c4d-1baf-4f66-9548-4409e8cf6099','f4cd94c1-52b0-4534-911f-0712ab2ad708','submitted','2026-06-29 15:32:03'),('b343fb18-de4e-4bd5-be5a-c68bff6d535f','3f1d4b3a-340a-44d2-b0a9-286eb45a43de','f4cd94c1-52b0-4534-911f-0712ab2ad708','submitted','2026-06-29 04:18:16'),('cf2600ae-aeba-4eef-9944-ceb9d1f54262','308000f4-37d2-4784-a643-83b8905bff17','f4cd94c1-52b0-4534-911f-0712ab2ad708','submitted','2026-06-30 08:30:40'),('df21c0e9-2ca4-4a1c-99a1-51c23a1076d5','f3eca309-d00b-4aba-9b35-c2c0423adfcd','919dfc64-281f-4b7f-9b5b-0b02d75a4109','submitted','2026-06-30 09:46:52');
/*!40000 ALTER TABLE `rfq_vendors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rfqs`
--

DROP TABLE IF EXISTS `rfqs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rfqs` (
  `id` varchar(36) NOT NULL,
  `rfq_number` varchar(50) NOT NULL,
  `title` varchar(500) NOT NULL,
  `description` text,
  `created_by` varchar(36) DEFAULT NULL,
  `submission_deadline` datetime NOT NULL,
  `status` enum('draft','published','closed','negotiation','awarded') DEFAULT 'draft',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `approval_workflow_id` varchar(36) DEFAULT NULL,
  `workflow_instance_id` varchar(36) DEFAULT NULL,
  `sla_due_date` datetime DEFAULT NULL,
  `sla_breach_flag` tinyint(1) DEFAULT '0',
  `escalation_level` int DEFAULT '0',
  `external_source` enum('API','Manual','Upload') DEFAULT 'Manual',
  `data_source_reference_id` varchar(100) DEFAULT NULL,
  `soft_delete_flag` tinyint(1) DEFAULT '0',
  `audit_log_reference_id` varchar(36) DEFAULT NULL,
  `rfq_type` varchar(20) DEFAULT 'Limited',
  `procurement_category_id` varchar(36) DEFAULT NULL,
  `budget_value` decimal(15,2) DEFAULT NULL,
  `scoring_weight_config` json DEFAULT NULL,
  `pr_id` varchar(36) DEFAULT NULL,
  `transaction_chain_id` varchar(36) DEFAULT NULL,
  `current_round` int NOT NULL DEFAULT '1',
  `company_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rfq_number` (`rfq_number`),
  KEY `idx_rfq_status` (`status`),
  KEY `idx_rfqs_chain` (`transaction_chain_id`),
  KEY `idx_rfqs_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rfqs`
--

LOCK TABLES `rfqs` WRITE;
/*!40000 ALTER TABLE `rfqs` DISABLE KEYS */;
INSERT INTO `rfqs` VALUES ('308000f4-37d2-4784-a643-83b8905bff17','RFQ-000003','Sourcing for PR-000003','checking','bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-07-01 00:00:00','awarded','2026-06-30 08:30:40','2026-06-30 08:37:03',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,'Limited',NULL,NULL,NULL,'01a83857-cb2b-4aa6-8194-d253e60a4704','01a83857-cb2b-4aa6-8194-d253e60a4704',1,NULL),('3f1d4b3a-340a-44d2-b0a9-286eb45a43de','RFQ-000001','Sourcing for PR-000001','check','bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-07-01 00:00:00','awarded','2026-06-29 04:18:16','2026-06-29 07:13:58',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,'Limited','2afc5aad-d942-41cb-87f4-aa3824e19864',1400000.00,NULL,'f4f3e756-9e8e-4460-b395-3bfbedaea076','f4f3e756-9e8e-4460-b395-3bfbedaea076',1,NULL),('9ec86c4d-1baf-4f66-9548-4409e8cf6099','RFQ-000002','Sourcing for PR-000002','immediate need','bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-30 00:00:00','awarded','2026-06-29 15:32:03','2026-06-29 15:53:25',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,'Limited',NULL,NULL,NULL,'748892b4-13b1-4cc9-836f-02b4d30d04f6','748892b4-13b1-4cc9-836f-02b4d30d04f6',1,NULL),('f3eca309-d00b-4aba-9b35-c2c0423adfcd','RFQ-000004','Sourcing for PR-000004','sample','bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-07-01 00:00:00','awarded','2026-06-30 09:46:52','2026-06-30 09:53:59',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,'Limited',NULL,NULL,NULL,'0bebe3a7-efb5-4768-a23d-a570146f118b','0bebe3a7-efb5-4768-a23d-a570146f118b',1,NULL);
/*!40000 ALTER TABLE `rfqs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_orders`
--

DROP TABLE IF EXISTS `sales_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_orders` (
  `id` varchar(36) NOT NULL,
  `so_number` varchar(50) NOT NULL,
  `selling_company_id` varchar(36) NOT NULL,
  `buying_company_id` varchar(36) NOT NULL,
  `source_po_id` varchar(36) NOT NULL,
  `total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `status` enum('open','fulfilled','cancelled') NOT NULL DEFAULT 'open',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `so_number` (`so_number`),
  KEY `selling_company_id` (`selling_company_id`),
  KEY `buying_company_id` (`buying_company_id`),
  KEY `idx_so_source_po` (`source_po_id`),
  CONSTRAINT `sales_orders_ibfk_1` FOREIGN KEY (`selling_company_id`) REFERENCES `company_master` (`id`),
  CONSTRAINT `sales_orders_ibfk_2` FOREIGN KEY (`buying_company_id`) REFERENCES `company_master` (`id`),
  CONSTRAINT `sales_orders_ibfk_3` FOREIGN KEY (`source_po_id`) REFERENCES `purchase_orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_orders`
--

LOCK TABLES `sales_orders` WRITE;
/*!40000 ALTER TABLE `sales_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_movements`
--

DROP TABLE IF EXISTS `stock_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_movements` (
  `id` varchar(36) NOT NULL,
  `warehouse_id` varchar(36) NOT NULL,
  `item_master_id` varchar(36) NOT NULL,
  `movement_type` enum('in','out','batch_in','return_out','transfer_out','transfer_in','consumption') NOT NULL,
  `quantity` decimal(15,3) NOT NULL,
  `reference_type` enum('grn','consumption','adjustment','batch','purchase_return','branch_order') NOT NULL,
  `reference_id` varchar(36) DEFAULT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `idx_stock_mv_item` (`item_master_id`),
  KEY `idx_stock_mv_ref` (`reference_type`,`reference_id`),
  CONSTRAINT `stock_movements_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `stock_movements_ibfk_2` FOREIGN KEY (`item_master_id`) REFERENCES `item_master` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_movements`
--

LOCK TABLES `stock_movements` WRITE;
/*!40000 ALTER TABLE `stock_movements` DISABLE KEYS */;
INSERT INTO `stock_movements` VALUES ('1dc940b5-61c0-4e96-b918-897d783c5a9c','3c84cfbb-5c9c-4371-a206-a7965c0203c8','ddee55ea-1fa0-4390-bf9b-d30ebba71a4c','in',1.000,'grn','0775ca64-b42e-454c-ad88-786a1d1ef147',NULL,NULL,'2026-06-29 16:31:57'),('4d99e0c8-4652-48bb-81f2-345e0bcb7931','3c84cfbb-5c9c-4371-a206-a7965c0203c8','ddee55ea-1fa0-4390-bf9b-d30ebba71a4c','in',1.000,'grn','2a103954-d98a-434a-a32f-a90a5863ec14',NULL,NULL,'2026-06-29 16:31:57'),('95287589-42f9-489c-b77f-5f9ff3875a80','3c84cfbb-5c9c-4371-a206-a7965c0203c8','ddee55ea-1fa0-4390-bf9b-d30ebba71a4c','in',12.000,'grn','9693f42f-03c6-49d5-9bc0-4b7b9ed6e6c8',NULL,NULL,'2026-06-29 16:31:57');
/*!40000 ALTER TABLE `stock_movements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sub_masters`
--

DROP TABLE IF EXISTS `sub_masters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sub_masters` (
  `id` varchar(36) NOT NULL,
  `category` varchar(100) NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(50) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `company_id` varchar(36) DEFAULT NULL,
  `tax_percentage` decimal(5,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_sub_masters_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sub_masters`
--

LOCK TABLES `sub_masters` WRITE;
/*!40000 ALTER TABLE `sub_masters` DISABLE KEYS */;
INSERT INTO `sub_masters` VALUES ('014356ec-582b-4439-806f-efe57e6848b6','registration_type','Public Limited',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('01741798-286e-4b11-85e9-086b6c260048','ticket_category','Invoice Dispute',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('0214d421-9129-45c5-a3a1-4c7ec4f5e5cc','payment_terms','Net 60',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('080db0ae-a915-466d-84e4-4237d226429b','city','Hyderabad',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('08ec5905-d493-402e-95a8-8a40545ee251','item_category','Consumables',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('0a18985d-3fbe-4078-8385-4d4e318fb991','city','Bangalore',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('0b747e11-5995-45f6-9bfb-17ef84344d85','cost_center','CC-PROC-01','Procurement',1,'2026-06-29 03:26:04',NULL,NULL),('14bc2d64-2f8e-4bca-b0ec-2055617c1feb','state','Maharashtra',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('1c6d0544-d095-4f24-a9b7-738bc20eddbe','department','HR',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('1fdd9c88-0975-41dd-8dcc-97ed8402f4e6','priority','High',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('23f1745e-0aaf-4a1f-9fd6-cc0a3af21ce9','ticket_category','General Inquiry',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('2437d3c1-c040-46f9-867d-2de986644400','plant','PLANT-03','Office',1,'2026-06-29 03:26:04',NULL,NULL),('24d4d9bb-656d-4b1a-9534-c58266a75396','cost_center','CC-FIN-01','Finance',1,'2026-06-29 03:26:04',NULL,NULL),('26e2f696-baa6-4a83-8500-b751f8405a07','item_subcategory','Fasteners & Hardware',NULL,1,'2026-06-29 03:29:16',NULL,NULL),('26e68295-9d8d-4430-a957-bc9c7054157e','item_subcategory','IT Software',NULL,1,'2026-06-29 03:29:16',NULL,NULL),('2a047ab0-0db7-40a5-ac5a-1abec52ef85c','priority','Medium',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('2afc5aad-d942-41cb-87f4-aa3824e19864','procurement_category','Capital Goods',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('2b387b13-c27f-433f-9c1b-045622ebe93a','uom','Set',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('2dc4b31b-1c48-401e-ae19-df730a4a4213','state','Karnataka',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('304759f1-3e77-435c-9a26-0ca9bfca5a1c','cost_center','CC-IT-01','IT',1,'2026-06-29 03:26:04',NULL,NULL),('31ccc62d-0080-4e3c-b114-18fccaaa6cd2','state','Telangana',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('35be8ec0-97b8-4537-a698-4b539daa375f','state','Gujarat',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('3677263b-bafd-4a2c-a569-0347396e1f23','msme_type','Small',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('3874a36a-6111-47b7-a2b6-88631dc7bc8c','item_subcategory','Pipes & Fittings',NULL,1,'2026-06-29 03:29:16',NULL,NULL),('39be9eab-9c87-4451-8186-3ffce1d07093','item_category','Raw Materials',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('3a2795df-e959-4360-9ecb-15b379b97bdc','supplier_category','Tier 1',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('3bfbf7d0-5685-42fe-88ba-dc46f1df7e79','plant','PLANT-02','Warehouse',1,'2026-06-29 03:26:04',NULL,NULL),('3d811dc2-ddd4-4494-be69-2ab9022c5227','item_subcategory','Furniture',NULL,1,'2026-06-29 03:29:16',NULL,NULL),('3da3bc19-c862-40a8-8458-04d4f9b930a5','item_subcategory','Steel & Metals',NULL,1,'2026-06-29 03:29:16',NULL,NULL),('3f6fd14d-f746-42b8-ace0-7aa795448f9d','item_subcategory','Electrical Components',NULL,1,'2026-06-29 03:29:16',NULL,NULL),('41b13b04-ea15-46e1-8c93-c2e6dce694bb','account_assignment_category','Cost Center',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('42d15984-c474-4368-a036-f137142dbc50','country','UK',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('458f9bc0-0fab-4bd2-88a9-d4dd18b052ab','incoterms','FOB',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('45b366bb-82a3-4bb8-8426-8ee21c5a57b6','procurement_category','Indirect Material',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('47498618-5580-4ed6-96b3-ab9f56449650','vendor_type','Service Provider',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('48f814ac-38f4-42f1-851f-c523a7286e03','state','Rajasthan',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('48f94034-1714-453c-a5ba-8de56e3cc15d','ticket_category','Delivery Issue',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('4b6d5202-efa6-4663-abdc-28b3f4cf55d2','country','India',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('4ca89a8b-387a-4b01-9378-994dbce45908','city','Chennai',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('4ce094b5-82cb-4c07-bf54-a0125e8daf76','currency','EUR',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('53c82057-2c8b-4746-b268-73823b898d87','cost_center','CC-001','cc01',1,'2026-06-28 16:15:58','da3debc2-03ff-4cc8-a99a-322e537020cf',NULL),('5b28b66e-8072-4c40-b678-043de4e5528e','shipment_mode','Air',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('5ec0cf8e-5747-419d-af47-ce3c15996bf9','priority','Low',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('5f083e44-1487-4ae2-98a1-a33ab9ad8244','plant','PLANT-01','Main Plant',1,'2026-06-29 03:26:04',NULL,NULL),('61c8e4b3-9769-43c4-a400-f41a1ac97e8e','item_category','Finished Goods',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('66097aec-c02c-42bf-9106-2393479f80ee','item_subcategory','Safety Equipment',NULL,1,'2026-06-29 03:29:16',NULL,NULL),('677ab61f-1d39-4a85-a540-8f91195793da','industry','Healthcare',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('6a871147-f6a7-44be-835a-3ddea8ede743','supplier_category','Tier 2',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('6c7d94e8-73fc-4783-98be-83ede9338a70','account_assignment_category','Asset',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('6f489a32-369d-441b-933e-862c3f9bf580','payment_terms','Net 30',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('70391475-6dfe-4952-8a24-957ff7b35143','registration_type','Partnership',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('73a8833a-fa38-48de-81e4-e353be77199a','supplier_category','Tier 3',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('740f75b4-f287-45db-8af8-4dbc0507f213','shipment_mode','Rail',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('75d2c305-385c-4ad2-84c1-7ec8f40f45a0','currency','INR',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('76c1931c-47f4-4dfa-8b0f-b17b9d4e3232','procurement_category','Direct Material',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('77a4650e-5f88-461e-b32b-2e84544591c6','supplier_group','Raw Materials',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('79e322da-968d-409f-866c-5285d87a2a4a','storage_location','SL-02','Cold Storage',1,'2026-06-29 03:26:04',NULL,NULL),('7a70567f-4e99-4ece-bae3-1acaee87a5de','uom','Nos',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('7c5c60c9-0f59-46ff-87da-cb394870488d','industry','FMCG',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('7c7aaf09-b769-46b8-8400-c0797d596c6f','industry','Manufacturing',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('7ced9735-a8ce-4e67-89cb-0045138851fd','procurement_category','Services',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('7f5616f7-4438-4176-9df0-53c84c23ebbe','department','Operations',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('84b47097-9e10-4a4b-8431-fd3411aa49b8','department','Procurement',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('857a5d5a-308e-48c5-9576-c0b2f5d5d9a8','item_subcategory','Packaging Materials',NULL,1,'2026-06-29 03:29:16',NULL,NULL),('864354e8-4a7f-42e7-8b57-a8ca8ec35370','registration_type','LLP',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('864c1f76-b0ea-4625-8451-391707598921','document_type','Framework Order',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('86b55a86-8637-465a-8078-4a8f08f9ce1a','supplier_group','IT Services',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('889273f0-7acd-486a-ada7-b9028dfde624','document_type','Service',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('8e1287ba-acd1-4107-9a3e-cf76d96768d1','ticket_category','Quality Issue',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('950108bc-4073-4a51-b3f8-905f2ec7397c','vendor_type','Manufacturer',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('96e991c1-cbc9-43f8-866f-e3056f861da9','item_category','Spare Parts',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('97086f90-f5ce-4fa6-a49d-80c6a75430e2','shipment_mode','Road',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('98e1d6b3-0832-423b-9887-f681e3277e83','cost_center','CC-OPS-01','Operations',1,'2026-06-29 03:26:04',NULL,NULL),('9a5313c4-9859-48e6-a1a6-2aaf0aeea013','industry','Construction',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('9a78f204-88f0-4b97-a762-871dbf1e0aef','state','Tamil Nadu',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('9b5af813-62b9-49a7-94b7-ea1a56320ada','city','Mumbai',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('9e3c5cd6-924f-43d8-8338-9e4f95237c50','payment_terms','Advance',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('9f10fe41-923e-498e-9063-c3507f209502','item_subcategory','IT Hardware',NULL,1,'2026-06-29 03:29:16',NULL,NULL),('9f7db8e0-402b-4c9e-8c4f-c6bdfd886c19','department','IT',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('a283ebcc-0048-43a4-a6f2-f6b42af14b08','item_subcategory','Polymers & Chemicals',NULL,1,'2026-06-29 03:29:16',NULL,NULL),('a2a86387-8c20-4985-9685-fd0aa7b066a1','currency','GBP',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('a2aa853f-99f7-4821-ac11-d50b1db1948f','supplier_group','Packaging',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('a658f3ff-f7af-442c-87ce-a86739024175','supplier_group','Equipment',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('a906f139-9436-4215-a4d0-6b9c345dba18','registration_type','Private Limited',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('ac89dde7-2606-46da-8490-161f2be00b19','department','Logistics',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('acd94467-1b33-4a0d-aa6d-edf3c1d56876','item_subcategory','Mechanical Parts',NULL,1,'2026-06-29 03:29:16',NULL,NULL),('af15c838-494e-4f95-9fb7-8dae4fc881d8','vendor_type','Consultant',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('b3677f77-7158-4933-b90a-3f98194c2ac6','country','USA',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('b444e47d-159a-4157-958d-34b34351e15e','incoterms','EXW',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('b58f1501-c262-4f81-90ce-73bfc31cff18','shipment_mode','Sea',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('b8e43a71-62a5-431d-b123-7b529ab11c05','industry','Technology',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('b9fe1d00-fdfa-4ca2-82a2-a73d75b163f7','city','Pune',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('bc5c75a0-dbd0-44ff-bbb8-8cc703f1e554','currency','USD',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('bd47004d-3ed6-413d-b06b-3394d7537ce8','incoterms','CIF',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('c0865e9e-c253-48dd-a272-362be570ad8c','uom','Roll',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('c11bf98e-8937-405b-abe6-8859ac19371e','priority','Critical',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('c1e94f71-583d-4661-b300-0002c8522728','uom','Box',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('c28ad7f7-af6a-4884-92d6-ff2435c12ffa','vendor_type','Distributor',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('d5b9163e-f187-4f44-80d9-904ecafc950d','state','Delhi',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('d5c7cd11-676e-472a-99c5-d6da094036fe','uom','Mtr',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('d9441ae8-17ff-4460-86f0-70d504ecae74','item_subcategory','Lubricants & Oils',NULL,1,'2026-06-29 03:29:16',NULL,NULL),('da4dfa2c-2821-4267-a6e6-6f00d0af9cc6','msme_type','Medium',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('dc5b3a2a-2f3c-4fcc-bc43-189774fb3646','incoterms','DDP',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('dd07ed6e-00b3-48ec-b5b2-0139a3774dbc','item_subcategory','Tools & Instruments',NULL,1,'2026-06-29 03:29:16',NULL,NULL),('dd1aa06a-0f2a-499f-8a4b-e18ba2a1d626','city','Delhi',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('dd31ee5e-6ccb-4a66-af9f-369d3b1ab876','payment_terms','Net 90',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('e187fad9-524c-45c5-96e1-95c78d600c2f','item_subcategory','Paper & Stationery',NULL,1,'2026-06-29 03:29:16',NULL,NULL),('e830baeb-602a-462c-9754-ea14cd11a447','msme_type','Micro',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('f154f273-9bb8-4bdc-bf02-d21dabc4418e','supplier_group','Services',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('f21dd7a2-43aa-418a-88a0-62a50c6550a3','registration_type','Proprietorship',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('f45ee62e-473f-4e07-bf96-0ea2a2b17934','uom','Ltr',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('f520996a-6df4-4f16-9338-9dc10352835d','storage_location','SL-01','Main Store',1,'2026-06-29 03:26:04',NULL,NULL),('f59d4f1d-1d52-49b5-847f-724d4913f4d5','account_assignment_category','Project',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('f5d7f46e-f7ad-412b-b168-b0704ceffc3e','uom','Kg',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('f7284ada-2f9e-4c6c-9e84-9a77ca04a3a9','city','Ahmedabad',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('f7b0064e-c4f1-45f2-b96a-157b8731c87a','document_type','Standard',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('f9f70c45-2a81-48b6-8e0c-a076a034b049','department','Finance',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('fd010510-5ada-4f3f-ae34-806fde48260e','item_category','Office Supplies',NULL,1,'2026-06-29 03:26:04',NULL,NULL),('feee8dcf-d471-4c7c-a389-12b05a1e7f46','item_subcategory','Cleaning Supplies',NULL,1,'2026-06-29 03:29:16',NULL,NULL);
/*!40000 ALTER TABLE `sub_masters` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `id` varchar(36) NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_settings`
--

LOCK TABLES `system_settings` WRITE;
/*!40000 ALTER TABLE `system_settings` DISABLE KEYS */;
INSERT INTO `system_settings` VALUES ('0352aa22-4def-4a6c-8b3d-755a89626f96','module_mode','advanced','2026-06-28 16:07:59'),('0e578722-b7b6-4ae0-a6a5-4cc492cb805b','modules_pricing','true','2026-06-28 16:07:59'),('1e2e6dbf-a03d-4fe0-8d1a-e340709d2ede','grn_quantity_tolerance_pct','5','2026-06-28 16:07:59'),('1ea05974-3b71-4924-8285-2e36a590c677','modules_esg','true','2026-06-28 16:07:59'),('27f7f3fd-0289-4a0f-9610-981790dedd07','po_require_pr_reference','false','2026-06-28 16:07:59'),('2f1a6391-e506-44a0-8c6c-4a4e01351c8d','vendor_portal_v2_enabled','true','2026-06-28 16:07:59'),('495c1b1a-ed8a-45d3-ad25-6744d15e8289','modules_audit','true','2026-06-28 16:07:59'),('4e652cc1-b9bb-46c2-b771-be301fec6067','modules_ticketing','true','2026-06-28 16:07:59'),('83ba9271-b517-473d-bc81-d19bd0598208','pr_budget_enforcement','soft','2026-06-28 16:07:59'),('92896caf-0413-40af-b7e4-715d175f07c0','invoice_price_tolerance_pct','2','2026-06-28 16:07:59'),('92a49b95-862c-4684-8234-1b8e78d1a678','pr_line_approval_categories','','2026-06-28 16:07:59'),('a35a66ed-002e-44a6-a88d-f34cebef9931','ui_improvements_enabled','true','2026-06-28 16:07:59'),('b15c8c92-29ba-467d-94c2-27a9a5ca3f91','pr_rfq_threshold_value','5000000','2026-06-29 04:15:44'),('b56fa060-9be5-4548-bc99-f97621ad2a2d','pr_line_approval_value_threshold','5000000','2026-06-29 04:15:00'),('c255680a-f11f-4037-afc5-645df7f878d9','payment_terms_days','30','2026-06-28 16:07:59'),('d2f0baa1-7ef1-4f4c-8aa4-3e96ea3c3651','asn_require_grn_invoice_match','true','2026-06-28 16:07:59'),('d35e97c4-c488-46b3-b4d4-2367cf2bef13','modules_risk','true','2026-06-28 16:07:59'),('d9391441-fd9e-4cea-a9d5-7e965d73f116','pr_number_prefix','PR','2026-06-28 16:07:59'),('e8229f0c-15f1-4bae-88c8-541086eab190','smart_assistant_enabled','true','2026-06-28 16:07:59');
/*!40000 ALTER TABLE `system_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ticket_messages`
--

DROP TABLE IF EXISTS `ticket_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ticket_messages` (
  `id` varchar(36) NOT NULL,
  `ticket_id` varchar(36) NOT NULL,
  `sender_id` varchar(36) NOT NULL,
  `sender_role` varchar(50) DEFAULT NULL,
  `message` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ticket_id` (`ticket_id`),
  CONSTRAINT `ticket_messages_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ticket_messages`
--

LOCK TABLES `ticket_messages` WRITE;
/*!40000 ALTER TABLE `ticket_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `ticket_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ticket_vendors`
--

DROP TABLE IF EXISTS `ticket_vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ticket_vendors` (
  `id` varchar(36) NOT NULL,
  `ticket_id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `status` enum('open','closed') DEFAULT 'open',
  `remarks` text,
  `closed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ticket_id` (`ticket_id`),
  KEY `vendor_id` (`vendor_id`),
  CONSTRAINT `ticket_vendors_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ticket_vendors_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ticket_vendors`
--

LOCK TABLES `ticket_vendors` WRITE;
/*!40000 ALTER TABLE `ticket_vendors` DISABLE KEYS */;
/*!40000 ALTER TABLE `ticket_vendors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tickets`
--

DROP TABLE IF EXISTS `tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tickets` (
  `id` varchar(36) NOT NULL,
  `ticket_number` varchar(50) NOT NULL,
  `subject` varchar(500) NOT NULL,
  `description` text,
  `priority` enum('low','medium','high','critical') DEFAULT 'medium',
  `status` enum('initiated','in_progress','vendor_closed','closed') DEFAULT 'initiated',
  `created_by` varchar(36) DEFAULT NULL,
  `rating` int DEFAULT NULL,
  `closure_remarks` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_at` timestamp NULL DEFAULT NULL,
  `approval_workflow_id` varchar(36) DEFAULT NULL,
  `workflow_instance_id` varchar(36) DEFAULT NULL,
  `sla_due_date` datetime DEFAULT NULL,
  `sla_breach_flag` tinyint(1) DEFAULT '0',
  `escalation_level` int DEFAULT '0',
  `external_source` enum('API','Manual','Upload') DEFAULT 'Manual',
  `data_source_reference_id` varchar(100) DEFAULT NULL,
  `soft_delete_flag` tinyint(1) DEFAULT '0',
  `audit_log_reference_id` varchar(36) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `root_cause` text,
  `resolution_type` varchar(100) DEFAULT NULL,
  `attachment_group_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ticket_number` (`ticket_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tickets`
--

LOCK TABLES `tickets` WRITE;
/*!40000 ALTER TABLE `tickets` DISABLE KEYS */;
/*!40000 ALTER TABLE `tickets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_company_access`
--

DROP TABLE IF EXISTS `user_company_access`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_company_access` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `company_id` varchar(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_company` (`user_id`,`company_id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `user_company_access_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `company_master` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_company_access`
--

LOCK TABLES `user_company_access` WRITE;
/*!40000 ALTER TABLE `user_company_access` DISABLE KEYS */;
INSERT INTO `user_company_access` VALUES ('011fda0a-4193-488e-ad08-73872e6693f3','e281a67d-213b-46a8-b300-e40324d73206','da3debc2-03ff-4cc8-a99a-322e537020cf','2026-06-28 16:12:13'),('8ad01745-c728-4b49-98d3-735fc5eeb24e','afd7d080-c9eb-4874-8bf9-4f8a81fca9a8','7156c100-ef23-437f-a38e-afaa71e883db','2026-06-28 16:11:49'),('8ca79ceb-94e4-422c-b4f6-730d45b64b44','c174c0df-7eac-41c9-b629-ee2f1b4c0ce4','7156c100-ef23-437f-a38e-afaa71e883db','2026-06-28 16:13:06'),('fb7d90dc-ea24-4367-81b7-ba889c6e89aa','bf975d4b-1794-4184-aa4f-24e187b1fdc3','da3debc2-03ff-4cc8-a99a-322e537020cf','2026-06-28 16:13:45'),('fde315b8-df21-4b2c-9057-166e9fdfa4fb','ce612583-ffa0-4a0a-930a-d71ffc075bb7','da3debc2-03ff-4cc8-a99a-322e537020cf','2026-06-30 10:05:56');
/*!40000 ALTER TABLE `user_company_access` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(36) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('mdm_admin','vendor','procurement_admin','system_admin') NOT NULL,
  `vendor_id` varchar(36) DEFAULT NULL,
  `must_reset_password` tinyint(1) DEFAULT '1',
  `full_name` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('49e3cf54-b11b-4650-8c57-b57f5d286390','sysadmin@procuretrack.com','$2b$12$o3fEJBf48/8UlfOEMnvfIOFZyRQF6Lnky2mJ3HzimSllQv7grA.v6','system_admin',NULL,0,'System Administrator',1,'2026-06-27 17:54:49','2026-06-27 17:54:49'),('afd7d080-c9eb-4874-8bf9-4f8a81fca9a8','mdm@jc.com','$2b$12$oQxIFKcvXSQRrcUjigVRSe.Ndo8MgHMZ7moikl5asiK43ldZwMCuu','mdm_admin',NULL,0,'JC',1,'2026-06-28 16:11:49','2026-06-28 16:11:49'),('b6e0ecc9-a38b-404e-91b5-b1b38f10da03','siemens@siemens.com','$2b$12$6tK9L6PlTJwRbiHZhkCGy.rfFHLu9TMKIvhIeuf/Mc5snE0SrJJRW','vendor','919dfc64-281f-4b7f-9b5b-0b02d75a4109',1,'Siemens',1,'2026-06-29 06:56:00','2026-06-29 06:56:23'),('bf975d4b-1794-4184-aa4f-24e187b1fdc3','procurementadmin@se.com','$2b$12$sJnJkEuL2MGcGRnLvHtgSeS20lPV/ryC0bx9AewC2TkAAaD0Xqun6','procurement_admin',NULL,0,'sepa',1,'2026-06-28 16:13:45','2026-06-28 16:13:45'),('c174c0df-7eac-41c9-b629-ee2f1b4c0ce4','procurementadmin@jc.com','$2b$12$1uCCp11RYdRFUxzYVcHhjOje7v.YlhcfdJe8psXpX86oY1JME3PCa','procurement_admin',NULL,0,'jspa',1,'2026-06-28 16:13:06','2026-06-28 16:13:06'),('ce612583-ffa0-4a0a-930a-d71ffc075bb7','raja@seren.com','$2b$12$oMRHKY/EUSW66WWLB1fUGe8Mm8QdYOMPSiluQnsWLj5AXUDJ6eNZC','vendor','d0280f04-f8c0-4f90-b0f3-96e49d91bc53',1,'raja',1,'2026-06-30 10:05:02','2026-06-30 10:05:56'),('e203ffe1-32dc-40bd-9964-5678d0d632fc','L&T@jc.com','$2b$12$w8iWFUQjKH5zFTC/VfDOKuziDRunJG2AQA9UMzcmaQvuhit2yEHPS','vendor','f4cd94c1-52b0-4534-911f-0712ab2ad708',1,'L&T',1,'2026-06-29 03:41:12','2026-06-29 03:46:41'),('e281a67d-213b-46a8-b300-e40324d73206','mdm@se.com','$2b$12$52WXQV9W.anVsdE9vvUO2u2FYAjH9jyPHYzSwqphmOS5qmwXOqIey','mdm_admin',NULL,0,'SE',1,'2026-06-28 16:12:13','2026-06-28 16:12:13');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_addresses`
--

DROP TABLE IF EXISTS `vendor_addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_addresses` (
  `id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `line1` varchar(500) NOT NULL,
  `line2` varchar(500) DEFAULT NULL,
  `city` varchar(100) NOT NULL,
  `state` varchar(100) NOT NULL,
  `country` varchar(100) NOT NULL DEFAULT 'India',
  `pin_code` varchar(10) NOT NULL,
  `tags` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `vendor_id` (`vendor_id`),
  CONSTRAINT `vendor_addresses_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_addresses`
--

LOCK TABLES `vendor_addresses` WRITE;
/*!40000 ALTER TABLE `vendor_addresses` DISABLE KEYS */;
INSERT INTO `vendor_addresses` VALUES ('2a90af16-2a66-425c-96d9-e4210a6e16ba','919dfc64-281f-4b7f-9b5b-0b02d75a4109','madhichiyam, middlestreet',NULL,'Chennai','Tamil Nadu','India','625020','[\"billing\", \"shipping\", \"registered\"]','2026-06-29 06:59:33'),('5145075a-7640-40b8-a63b-9e8618cda631','f4cd94c1-52b0-4534-911f-0712ab2ad708','Porur','Porur Karapakan','Chennai','Tamil Nadu','India','600017','[\"billing\", \"shipping\", \"registered\"]','2026-06-29 03:48:50'),('fd15e031-2bd1-4f47-adfa-71f31b02bcb2','d0280f04-f8c0-4f90-b0f3-96e49d91bc53','madhichiyam',NULL,'Chennai','Tamil Nadu','India','600020','[\"billing\", \"shipping\", \"registered\"]','2026-06-30 10:07:54');
/*!40000 ALTER TABLE `vendor_addresses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_bank_accounts`
--

DROP TABLE IF EXISTS `vendor_bank_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_bank_accounts` (
  `id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `ifsc_code` varchar(11) NOT NULL,
  `account_number` varchar(30) NOT NULL,
  `account_holder_name` varchar(255) NOT NULL,
  `bank_name` varchar(255) NOT NULL,
  `branch` varchar(255) NOT NULL,
  `city` varchar(100) NOT NULL,
  `state` varchar(100) NOT NULL,
  `country` varchar(100) NOT NULL DEFAULT 'India',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `vendor_id` (`vendor_id`),
  CONSTRAINT `vendor_bank_accounts_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_bank_accounts`
--

LOCK TABLES `vendor_bank_accounts` WRITE;
/*!40000 ALTER TABLE `vendor_bank_accounts` DISABLE KEYS */;
INSERT INTO `vendor_bank_accounts` VALUES ('575670a5-d894-4fe3-8f19-e613d74ccaea','d0280f04-f8c0-4f90-b0f3-96e49d91bc53','232344','23232','raja','raja','ch','Chennai','Tamil Nadu','India','2026-06-30 10:07:54'),('c99aa5bf-0a4e-4479-a8ec-0532724336ba','919dfc64-281f-4b7f-9b5b-0b02d75a4109','5435432','23243434','raja','raja','raja','Chennai','Tamil Nadu','India','2026-06-29 06:59:33'),('d67a97b0-4c07-49ce-afef-0a37848877ae','f4cd94c1-52b0-4534-911f-0712ab2ad708','347387','8878787','l&t','icici bank','porur','Chennai','Tamil Nadu','India','2026-06-29 03:48:50');
/*!40000 ALTER TABLE `vendor_bank_accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_bid_items`
--

DROP TABLE IF EXISTS `vendor_bid_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_bid_items` (
  `id` varchar(36) NOT NULL,
  `bid_id` varchar(36) NOT NULL,
  `rfq_line_item_id` varchar(36) NOT NULL,
  `unit_price` decimal(15,2) NOT NULL,
  `lead_time_days` int DEFAULT NULL,
  `remarks` text,
  `attachment_path` varchar(500) DEFAULT NULL,
  `attachment_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `bid_id` (`bid_id`),
  KEY `rfq_line_item_id` (`rfq_line_item_id`),
  CONSTRAINT `vendor_bid_items_ibfk_1` FOREIGN KEY (`bid_id`) REFERENCES `vendor_bids` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vendor_bid_items_ibfk_2` FOREIGN KEY (`rfq_line_item_id`) REFERENCES `rfq_line_items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_bid_items`
--

LOCK TABLES `vendor_bid_items` WRITE;
/*!40000 ALTER TABLE `vendor_bid_items` DISABLE KEYS */;
INSERT INTO `vendor_bid_items` VALUES ('193eaec3-6bbd-4d1d-8386-a2842f72fb38','a221866e-ec0f-4202-820e-dda5529ab128','5a852a01-1a02-4fc0-9021-d6397e233aef',120000.00,12,NULL,NULL,NULL),('2b89e592-27db-45af-afde-b30fe6189f2e','384d02b4-6b8f-4a2d-a375-475c59f0139d','4a477d88-fb4e-439e-89d3-8bba5161851e',120000.00,10,NULL,NULL,NULL),('38daa36a-5b46-4f56-a26c-b11ee52aefec','e884aab0-4e3f-4321-8342-50bb65b0a48b','5a852a01-1a02-4fc0-9021-d6397e233aef',125000.00,22,NULL,NULL,NULL),('3df359b0-ea00-41d7-a62d-8e9b7db44214','7aa59984-c225-4b00-a8c0-9cc3798e53db','9e86d0f8-5a12-42d7-a903-22a4833be4f8',130000.00,1,NULL,NULL,NULL),('658e7e48-d472-48aa-9010-f4aa4d19a4dd','3a854c35-aa0f-4647-967b-80ed3b223fd0','04cb4d79-38ae-4477-8c9d-907f5f13640f',110000.00,10,NULL,NULL,NULL),('82ee90cb-2845-4cfd-8adb-ce9557002154','b15d217b-5ad0-4871-b770-330d5da1c670','04cb4d79-38ae-4477-8c9d-907f5f13640f',120000.00,4,NULL,NULL,NULL),('a337ef1a-b051-41fa-93b4-91491323eec4','c6af638f-1bdc-4df9-adf1-d941c1ee870b','9e86d0f8-5a12-42d7-a903-22a4833be4f8',127000.00,5,NULL,NULL,NULL),('a7a2f819-6492-4f2f-9b2e-73f047acdfa2','b4fbcef7-3679-47b8-b56f-ecb3c09032aa','4a477d88-fb4e-439e-89d3-8bba5161851e',128000.00,2,NULL,NULL,NULL);
/*!40000 ALTER TABLE `vendor_bid_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_bids`
--

DROP TABLE IF EXISTS `vendor_bids`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_bids` (
  `id` varchar(36) NOT NULL,
  `rfq_id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `total_value` decimal(15,2) DEFAULT NULL,
  `remarks` text,
  `status` enum('submitted','revised') DEFAULT 'submitted',
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `taxes_included_flag` tinyint(1) DEFAULT '0',
  `offered_payment_terms` varchar(100) DEFAULT NULL,
  `warranty_period` varchar(100) DEFAULT NULL,
  `deviation_flag` tinyint(1) DEFAULT '0',
  `tco_value` decimal(15,2) DEFAULT NULL,
  `overall_attachment_path` varchar(500) DEFAULT NULL,
  `overall_attachment_name` varchar(255) DEFAULT NULL,
  `round_number` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rfq_bid_round` (`rfq_id`,`vendor_id`,`round_number`),
  KEY `vendor_id` (`vendor_id`),
  CONSTRAINT `vendor_bids_ibfk_1` FOREIGN KEY (`rfq_id`) REFERENCES `rfqs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vendor_bids_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_bids`
--

LOCK TABLES `vendor_bids` WRITE;
/*!40000 ALTER TABLE `vendor_bids` DISABLE KEYS */;
INSERT INTO `vendor_bids` VALUES ('384d02b4-6b8f-4a2d-a375-475c59f0139d','f3eca309-d00b-4aba-9b35-c2c0423adfcd','f4cd94c1-52b0-4534-911f-0712ab2ad708',120000.00,'Best price','submitted','2026-06-30 09:48:26','2026-06-30 09:48:26',1,'30','12',1,120000.00,NULL,NULL,1),('3a854c35-aa0f-4647-967b-80ed3b223fd0','9ec86c4d-1baf-4f66-9548-4409e8cf6099','919dfc64-281f-4b7f-9b5b-0b02d75a4109',220000.00,'check','submitted','2026-06-29 15:46:51','2026-06-29 15:46:51',1,'15','15',1,220000.00,NULL,NULL,1),('7aa59984-c225-4b00-a8c0-9cc3798e53db','3f1d4b3a-340a-44d2-b0a9-286eb45a43de','f4cd94c1-52b0-4534-911f-0712ab2ad708',1560000.00,'check','submitted','2026-06-29 07:03:06','2026-06-29 07:03:06',1,'12','12',1,1560000.00,NULL,NULL,1),('a221866e-ec0f-4202-820e-dda5529ab128','308000f4-37d2-4784-a643-83b8905bff17','f4cd94c1-52b0-4534-911f-0712ab2ad708',240000.00,'checking','submitted','2026-06-30 08:34:24','2026-06-30 08:34:24',1,'15','12',1,240000.00,NULL,NULL,1),('b15d217b-5ad0-4871-b770-330d5da1c670','9ec86c4d-1baf-4f66-9548-4409e8cf6099','f4cd94c1-52b0-4534-911f-0712ab2ad708',240000.00,'check','submitted','2026-06-29 15:46:13','2026-06-29 15:46:13',1,'10','10',1,240000.00,NULL,NULL,1),('b4fbcef7-3679-47b8-b56f-ecb3c09032aa','f3eca309-d00b-4aba-9b35-c2c0423adfcd','919dfc64-281f-4b7f-9b5b-0b02d75a4109',128000.00,'ok','submitted','2026-06-30 09:49:01','2026-06-30 09:49:01',1,'45','10',1,128000.00,NULL,NULL,1),('c6af638f-1bdc-4df9-adf1-d941c1ee870b','3f1d4b3a-340a-44d2-b0a9-286eb45a43de','919dfc64-281f-4b7f-9b5b-0b02d75a4109',1524000.00,'check','submitted','2026-06-29 07:03:53','2026-06-29 07:03:53',1,'12','12',1,1524000.00,NULL,NULL,1),('e884aab0-4e3f-4321-8342-50bb65b0a48b','308000f4-37d2-4784-a643-83b8905bff17','919dfc64-281f-4b7f-9b5b-0b02d75a4109',250000.00,'checking','submitted','2026-06-30 08:34:53','2026-06-30 08:34:53',1,'20','20',1,250000.00,NULL,NULL,1);
/*!40000 ALTER TABLE `vendor_bids` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_company_mapping`
--

DROP TABLE IF EXISTS `vendor_company_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_company_mapping` (
  `id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `company_id` varchar(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vendor_company` (`vendor_id`,`company_id`),
  KEY `idx_vcm_vendor` (`vendor_id`),
  KEY `idx_vcm_company` (`company_id`),
  CONSTRAINT `vendor_company_mapping_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`),
  CONSTRAINT `vendor_company_mapping_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `company_master` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_company_mapping`
--

LOCK TABLES `vendor_company_mapping` WRITE;
/*!40000 ALTER TABLE `vendor_company_mapping` DISABLE KEYS */;
INSERT INTO `vendor_company_mapping` VALUES ('7054ed40-ac69-4019-8ee3-aae6242dd176','919dfc64-281f-4b7f-9b5b-0b02d75a4109','da3debc2-03ff-4cc8-a99a-322e537020cf','2026-06-29 06:56:00'),('c17102ae-7799-4c99-ab33-9a92061b1982','d0280f04-f8c0-4f90-b0f3-96e49d91bc53','da3debc2-03ff-4cc8-a99a-322e537020cf','2026-06-30 10:05:02'),('eaefdeb2-8cee-4e2b-ad41-f9afaf1a7115','f4cd94c1-52b0-4534-911f-0712ab2ad708','da3debc2-03ff-4cc8-a99a-322e537020cf','2026-06-29 03:41:12');
/*!40000 ALTER TABLE `vendor_company_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_documents`
--

DROP TABLE IF EXISTS `vendor_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_documents` (
  `id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `doc_type` enum('pan','gst_certificate','cin','msme_certificate','bank_proof','other') NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `vendor_id` (`vendor_id`),
  CONSTRAINT `vendor_documents_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_documents`
--

LOCK TABLES `vendor_documents` WRITE;
/*!40000 ALTER TABLE `vendor_documents` DISABLE KEYS */;
INSERT INTO `vendor_documents` VALUES ('0324223f-3a24-4863-b6fe-cf10eadc2d6f','919dfc64-281f-4b7f-9b5b-0b02d75a4109','pan','Screenshot 2026-06-29 at 12.18.23â¯PM.png','uploads/e6214dca-c033-4979-bed5-8550f0d6a376.png','2026-06-29 06:59:15'),('52b974f8-b4c3-4259-844b-9d3ed14e7d41','f4cd94c1-52b0-4534-911f-0712ab2ad708','pan','Screenshot 2026-06-28 at 7.38.55â¯PM.png','uploads/cdf066d5-1e7d-4e1d-aaee-439832f94474.png','2026-06-29 03:48:28');
/*!40000 ALTER TABLE `vendor_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_esg`
--

DROP TABLE IF EXISTS `vendor_esg`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_esg` (
  `id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `diversity_flag` tinyint(1) DEFAULT '0',
  `compliance_status` enum('compliant','non_compliant','pending') DEFAULT 'pending',
  `remarks` text,
  `updated_by` varchar(36) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `approval_workflow_id` varchar(36) DEFAULT NULL,
  `workflow_instance_id` varchar(36) DEFAULT NULL,
  `sla_due_date` datetime DEFAULT NULL,
  `sla_breach_flag` tinyint(1) DEFAULT '0',
  `escalation_level` int DEFAULT '0',
  `external_source` enum('API','Manual','Upload') DEFAULT 'Manual',
  `data_source_reference_id` varchar(100) DEFAULT NULL,
  `soft_delete_flag` tinyint(1) DEFAULT '0',
  `audit_log_reference_id` varchar(36) DEFAULT NULL,
  `carbon_emission_score` decimal(5,2) DEFAULT NULL,
  `energy_consumption` decimal(15,2) DEFAULT NULL,
  `waste_management_score` decimal(5,2) DEFAULT NULL,
  `certification_list` json DEFAULT NULL,
  `esg_document_group_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vendor_id` (`vendor_id`),
  CONSTRAINT `vendor_esg_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_esg`
--

LOCK TABLES `vendor_esg` WRITE;
/*!40000 ALTER TABLE `vendor_esg` DISABLE KEYS */;
/*!40000 ALTER TABLE `vendor_esg` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_ledger`
--

DROP TABLE IF EXISTS `vendor_ledger`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_ledger` (
  `id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `transaction_type` enum('invoice','payment') NOT NULL,
  `reference_id` varchar(36) NOT NULL,
  `debit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `credit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `running_balance` decimal(15,2) NOT NULL DEFAULT '0.00',
  `transaction_date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ledger_vendor` (`vendor_id`),
  KEY `idx_ledger_date` (`transaction_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_ledger`
--

LOCK TABLES `vendor_ledger` WRITE;
/*!40000 ALTER TABLE `vendor_ledger` DISABLE KEYS */;
/*!40000 ALTER TABLE `vendor_ledger` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_risk_scores`
--

DROP TABLE IF EXISTS `vendor_risk_scores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_risk_scores` (
  `id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `risk_score` decimal(5,2) DEFAULT '0.00',
  `risk_level` enum('low','medium','high') DEFAULT 'low',
  `delay_score` decimal(5,2) DEFAULT '0.00',
  `rejection_score` decimal(5,2) DEFAULT '0.00',
  `audit_score` decimal(5,2) DEFAULT '0.00',
  `calculated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `approval_workflow_id` varchar(36) DEFAULT NULL,
  `workflow_instance_id` varchar(36) DEFAULT NULL,
  `sla_due_date` datetime DEFAULT NULL,
  `sla_breach_flag` tinyint(1) DEFAULT '0',
  `escalation_level` int DEFAULT '0',
  `external_source` enum('API','Manual','Upload') DEFAULT 'Manual',
  `data_source_reference_id` varchar(100) DEFAULT NULL,
  `soft_delete_flag` tinyint(1) DEFAULT '0',
  `audit_log_reference_id` varchar(36) DEFAULT NULL,
  `risk_trend` enum('improving','stable','worsening') DEFAULT 'stable',
  `financial_risk_score` decimal(5,2) DEFAULT '0.00',
  `dependency_risk_score` decimal(5,2) DEFAULT '0.00',
  `geographic_risk_score` decimal(5,2) DEFAULT '0.00',
  `esg_risk_score` decimal(5,2) DEFAULT '0.00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `vendor_id` (`vendor_id`),
  CONSTRAINT `vendor_risk_scores_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_risk_scores`
--

LOCK TABLES `vendor_risk_scores` WRITE;
/*!40000 ALTER TABLE `vendor_risk_scores` DISABLE KEYS */;
INSERT INTO `vendor_risk_scores` VALUES ('5f66d975-fc4b-4e47-b865-45a9e50de842','d0280f04-f8c0-4f90-b0f3-96e49d91bc53',1.50,'low',0.00,0.00,0.00,'2026-06-30 10:08:26',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,'stable',10.00,0.00,0.00,0.00),('babaf52d-9cae-4450-9b88-ed1ebab81974','919dfc64-281f-4b7f-9b5b-0b02d75a4109',2.50,'low',0.00,0.00,0.00,'2026-06-30 09:53:01',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,'stable',10.00,10.00,0.00,0.00),('f7321fba-7ffe-439d-9a27-6a86bdf69a04','f4cd94c1-52b0-4534-911f-0712ab2ad708',4.50,'low',10.00,0.00,0.00,'2026-06-30 10:20:31',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,'stable',10.00,10.00,0.00,0.00);
/*!40000 ALTER TABLE `vendor_risk_scores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendors`
--

DROP TABLE IF EXISTS `vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendors` (
  `id` varchar(36) NOT NULL,
  `vendor_number` varchar(50) DEFAULT NULL,
  `vendor_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `company_name` varchar(255) NOT NULL,
  `department` varchar(255) NOT NULL,
  `supplier_group` varchar(255) NOT NULL,
  `supplier_category` varchar(255) NOT NULL,
  `supplier_location` varchar(255) NOT NULL,
  `status` enum('draft','submitted','under_review','approved','rejected','inactive') DEFAULT 'draft',
  `rejection_reason` text,
  `gst_number` varchar(15) DEFAULT NULL,
  `pan_number` varchar(10) DEFAULT NULL,
  `trade_name` varchar(255) DEFAULT NULL,
  `legal_name` varchar(255) DEFAULT NULL,
  `msme_type` varchar(100) DEFAULT NULL,
  `itr_filing_status` varchar(100) DEFAULT NULL,
  `phone1` varchar(20) DEFAULT NULL,
  `phone2` varchar(20) DEFAULT NULL,
  `email1` varchar(255) DEFAULT NULL,
  `email2` varchar(255) DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `approval_workflow_id` varchar(36) DEFAULT NULL,
  `workflow_instance_id` varchar(36) DEFAULT NULL,
  `sla_due_date` datetime DEFAULT NULL,
  `sla_breach_flag` tinyint(1) DEFAULT '0',
  `escalation_level` int DEFAULT '0',
  `external_source` enum('API','Manual','Upload') DEFAULT 'Manual',
  `data_source_reference_id` varchar(100) DEFAULT NULL,
  `soft_delete_flag` tinyint(1) DEFAULT '0',
  `audit_log_reference_id` varchar(36) DEFAULT NULL,
  `vendor_code` varchar(50) DEFAULT NULL,
  `vendor_code_auto` varchar(50) DEFAULT NULL,
  `vendor_type` varchar(100) DEFAULT NULL,
  `industry` varchar(100) DEFAULT NULL,
  `registration_type` varchar(100) DEFAULT NULL,
  `gst_validation_status` enum('pending','valid','invalid') DEFAULT 'pending',
  `pan_validation_status` enum('pending','valid','invalid') DEFAULT 'pending',
  `credit_rating` varchar(10) DEFAULT NULL,
  `credit_limit` decimal(15,2) DEFAULT NULL,
  `payment_terms_id` varchar(36) DEFAULT NULL,
  `currency_code` varchar(3) DEFAULT 'INR',
  `risk_category` enum('low','medium','high') DEFAULT NULL,
  `blacklist_flag` tinyint(1) DEFAULT '0',
  `blacklist_reason` text,
  `compliance_expiry_dates` json DEFAULT NULL,
  `geo_latitude` decimal(10,7) DEFAULT NULL,
  `geo_longitude` decimal(10,7) DEFAULT NULL,
  `serviceable_regions` json DEFAULT NULL,
  `account_manager_name` varchar(255) DEFAULT NULL,
  `lifecycle_stage` enum('onboarding','active','dormant','blocked') DEFAULT 'onboarding',
  `preferred_vendor_flag` tinyint(1) DEFAULT '0',
  `vendor_segment` enum('strategic','preferred','approved','tactical') NOT NULL DEFAULT 'approved',
  `internal_company_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vendor_number` (`vendor_number`),
  UNIQUE KEY `uq_vendor_code` (`vendor_code`),
  UNIQUE KEY `uq_vendor_code_auto` (`vendor_code_auto`),
  KEY `idx_status` (`status`),
  KEY `idx_email` (`email`),
  KEY `idx_vendors_segment` (`vendor_segment`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendors`
--

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
INSERT INTO `vendors` VALUES ('919dfc64-281f-4b7f-9b5b-0b02d75a4109','VND-MQYV68UW','Siemens','siemens@siemens.com','9878787878','Shanti Electricals','Operations','Raw Materials','Tier 1','Madurai','approved',NULL,'2323435423','3435543q43','siemens','siemens','Medium','filed','235435543','34543543','nomail@nomail.com','nomail@nomail.com','e281a67d-213b-46a8-b300-e40324d73206','2026-06-29 06:56:00','2026-06-29 06:59:56',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,'ERP-VND-002','VC-000002','Manufacturer','Manufacturing','Private Limited','invalid','invalid',NULL,NULL,NULL,'INR',NULL,0,NULL,NULL,12.0000000,12.0000000,'[\"India\"]','CH','active',0,'approved',NULL),('d0280f04-f8c0-4f90-b0f3-96e49d91bc53','VND-MR0HD79S','raja','raja@seren.com','98989','Shanti Electricals','HR','IT Services','Tier 2','madurai','approved',NULL,'i78889889','8989898','raja','raja','Micro','filed','89898989','989898988','raj@raj.com','raj@raj.com','e281a67d-213b-46a8-b300-e40324d73206','2026-06-30 10:05:02','2026-06-30 10:08:31',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,'ERP-001','VC-000003','Consultant','FMCG','LLP','invalid','invalid',NULL,NULL,NULL,'INR',NULL,0,NULL,NULL,23.0000000,23.0000000,'[\"madurai\", \"chennai\"]','cg','active',0,'approved',NULL),('f4cd94c1-52b0-4534-911f-0712ab2ad708','VND-MQYO7QPG','L&T','L&T@jc.com','8788897','Shanti Electricals','Finance','Equipment','Tier 2','Madurai','approved',NULL,'8798989','989898','laursen','construction','Medium','filed','7889898','878787889','raja@raja.co','raja1@raja.co','bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-29 03:41:12','2026-06-29 03:49:15',NULL,NULL,NULL,0,0,'Manual',NULL,0,NULL,'VND-001','VC-000001','Manufacturer','Manufacturing','Partnership','invalid','invalid',NULL,NULL,NULL,'INR',NULL,0,NULL,NULL,23.0000000,12.0000000,'[\"India\"]','raja','active',0,'approved',NULL);
/*!40000 ALTER TABLE `vendors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `warehouses`
--

DROP TABLE IF EXISTS `warehouses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `warehouses` (
  `id` varchar(36) NOT NULL,
  `warehouse_code` varchar(20) NOT NULL,
  `warehouse_name` varchar(150) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `company_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `warehouse_code` (`warehouse_code`),
  KEY `idx_warehouses_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `warehouses`
--

LOCK TABLES `warehouses` WRITE;
/*!40000 ALTER TABLE `warehouses` DISABLE KEYS */;
INSERT INTO `warehouses` VALUES ('3c84cfbb-5c9c-4371-a206-a7965c0203c8','DEFAULT','Default Warehouse',NULL,1,'2026-06-28 16:03:16',NULL);
/*!40000 ALTER TABLE `warehouses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workflow_instance_step_approvals`
--

DROP TABLE IF EXISTS `workflow_instance_step_approvals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_instance_step_approvals` (
  `id` varchar(36) NOT NULL,
  `instance_id` varchar(36) NOT NULL,
  `step_id` varchar(36) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `actor_id` varchar(36) DEFAULT NULL,
  `remarks` text,
  `sla_due_at` timestamp NULL DEFAULT NULL,
  `escalated` tinyint(1) NOT NULL DEFAULT '0',
  `escalated_at` timestamp NULL DEFAULT NULL,
  `decided_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `step_id` (`step_id`),
  KEY `idx_wisa_instance` (`instance_id`),
  KEY `idx_wisa_pending_sla` (`status`,`sla_due_at`),
  CONSTRAINT `workflow_instance_step_approvals_ibfk_1` FOREIGN KEY (`instance_id`) REFERENCES `workflow_instances` (`id`) ON DELETE CASCADE,
  CONSTRAINT `workflow_instance_step_approvals_ibfk_2` FOREIGN KEY (`step_id`) REFERENCES `workflow_steps` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workflow_instance_step_approvals`
--

LOCK TABLES `workflow_instance_step_approvals` WRITE;
/*!40000 ALTER TABLE `workflow_instance_step_approvals` DISABLE KEYS */;
INSERT INTO `workflow_instance_step_approvals` VALUES ('740c9347-b06a-4a5c-a10d-66e8f8221baa','2614eb9c-ded3-4503-b016-905d63c186a3','f5b11308-50a9-43f3-a554-3499f8b66471','approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-30 04:08:35',0,NULL,'2026-06-29 04:16:08','2026-06-29 04:08:34'),('87b74b2e-7ce1-4517-bd5c-5d2eff540f5a','5fe1aab7-1b4a-47e7-a385-73b769a8557d','f5b11308-50a9-43f3-a554-3499f8b66471','approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-07-01 08:26:03',0,NULL,'2026-06-30 08:30:00','2026-06-30 08:26:02'),('b0695bb1-215e-4ef9-b8b8-3480c572a378','74a0125f-c662-4f36-bfe9-18dcb2b17ea5','f5b11308-50a9-43f3-a554-3499f8b66471','approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-07-01 09:44:36',0,NULL,'2026-06-30 09:44:49','2026-06-30 09:44:36'),('d766b45f-b559-470a-8648-10703d8b0b6e','6047fdc5-d1dd-4fb4-9ec4-2bfe0879dea3','f5b11308-50a9-43f3-a554-3499f8b66471','approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-30 15:31:31',0,NULL,'2026-06-29 15:31:37','2026-06-29 15:31:31');
/*!40000 ALTER TABLE `workflow_instance_step_approvals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workflow_instances`
--

DROP TABLE IF EXISTS `workflow_instances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_instances` (
  `id` varchar(36) NOT NULL,
  `workflow_id` varchar(36) NOT NULL,
  `module_name` varchar(100) NOT NULL,
  `record_id` varchar(36) NOT NULL,
  `current_step_id` varchar(36) DEFAULT NULL,
  `status` enum('in_progress','approved','rejected','cancelled') DEFAULT 'in_progress',
  `initiated_by` varchar(36) DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  `current_step_order` int DEFAULT NULL,
  `context` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `workflow_id` (`workflow_id`),
  KEY `current_step_id` (`current_step_id`),
  KEY `idx_instance_record` (`module_name`,`record_id`),
  KEY `idx_instance_status` (`status`),
  CONSTRAINT `workflow_instances_ibfk_1` FOREIGN KEY (`workflow_id`) REFERENCES `workflow_master` (`id`),
  CONSTRAINT `workflow_instances_ibfk_2` FOREIGN KEY (`current_step_id`) REFERENCES `workflow_steps` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workflow_instances`
--

LOCK TABLES `workflow_instances` WRITE;
/*!40000 ALTER TABLE `workflow_instances` DISABLE KEYS */;
INSERT INTO `workflow_instances` VALUES ('2614eb9c-ded3-4503-b016-905d63c186a3','d5a73eed-ac84-40e5-ae3e-8eed48c651d4','purchase_requisition','f4f3e756-9e8e-4460-b395-3bfbedaea076',NULL,'approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-29 04:08:34','2026-06-29 04:16:08',NULL,'{\"category\": \"Standard\", \"total_value\": 1542000, \"vendor_risk_level\": \"low\"}'),('5fe1aab7-1b4a-47e7-a385-73b769a8557d','d5a73eed-ac84-40e5-ae3e-8eed48c651d4','purchase_requisition','01a83857-cb2b-4aa6-8194-d253e60a4704',NULL,'approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-30 08:26:02','2026-06-30 08:30:00',NULL,'{\"category\": \"Standard\", \"total_value\": 257000, \"vendor_risk_level\": \"low\"}'),('6047fdc5-d1dd-4fb4-9ec4-2bfe0879dea3','d5a73eed-ac84-40e5-ae3e-8eed48c651d4','purchase_requisition','748892b4-13b1-4cc9-836f-02b4d30d04f6',NULL,'approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-29 15:31:31','2026-06-29 15:31:37',NULL,'{\"category\": \"Standard\", \"total_value\": 257000, \"vendor_risk_level\": \"low\"}'),('74a0125f-c662-4f36-bfe9-18dcb2b17ea5','d5a73eed-ac84-40e5-ae3e-8eed48c651d4','purchase_requisition','0bebe3a7-efb5-4768-a23d-a570146f118b',NULL,'approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3','2026-06-30 09:44:36','2026-06-30 09:44:49',NULL,'{\"category\": \"Standard\", \"total_value\": 128500, \"vendor_risk_level\": \"low\"}');
/*!40000 ALTER TABLE `workflow_instances` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workflow_logs`
--

DROP TABLE IF EXISTS `workflow_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_logs` (
  `id` varchar(36) NOT NULL,
  `instance_id` varchar(36) NOT NULL,
  `step_id` varchar(36) DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `actor_id` varchar(36) DEFAULT NULL,
  `remarks` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `instance_id` (`instance_id`),
  KEY `step_id` (`step_id`),
  CONSTRAINT `workflow_logs_ibfk_1` FOREIGN KEY (`instance_id`) REFERENCES `workflow_instances` (`id`) ON DELETE CASCADE,
  CONSTRAINT `workflow_logs_ibfk_2` FOREIGN KEY (`step_id`) REFERENCES `workflow_steps` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workflow_logs`
--

LOCK TABLES `workflow_logs` WRITE;
/*!40000 ALTER TABLE `workflow_logs` DISABLE KEYS */;
INSERT INTO `workflow_logs` VALUES ('00a5fffb-777c-4896-b831-1c6e53c27357','6047fdc5-d1dd-4fb4-9ec4-2bfe0879dea3',NULL,'approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-29 15:31:37'),('0db13c37-82fe-4fc8-aa8f-52048e6ecb26','2614eb9c-ded3-4503-b016-905d63c186a3',NULL,'approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-29 04:16:08'),('281e8ede-a7a6-4748-b3dd-7f0c2adcb399','5fe1aab7-1b4a-47e7-a385-73b769a8557d',NULL,'approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-30 08:30:00'),('2ad452eb-68fb-4727-bb35-15663ad9d469','74a0125f-c662-4f36-bfe9-18dcb2b17ea5',NULL,'approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-30 09:44:49'),('4dcc4f68-f12e-4e39-aae7-66e547df7861','74a0125f-c662-4f36-bfe9-18dcb2b17ea5','f5b11308-50a9-43f3-a554-3499f8b66471','approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-30 09:44:49'),('5b84b4f6-c3d0-4083-91b4-14ce1f47c4b9','5fe1aab7-1b4a-47e7-a385-73b769a8557d','f5b11308-50a9-43f3-a554-3499f8b66471','approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-30 08:30:00'),('5c3994d0-1a67-41cd-a634-ec6c7e978929','2614eb9c-ded3-4503-b016-905d63c186a3','f5b11308-50a9-43f3-a554-3499f8b66471','approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-29 04:16:08'),('c21177cd-6a4a-44e5-a056-0c73f078e2a2','74a0125f-c662-4f36-bfe9-18dcb2b17ea5','f5b11308-50a9-43f3-a554-3499f8b66471','started','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-30 09:44:36'),('c3ccd718-99e4-44db-9939-3f9995c373fb','6047fdc5-d1dd-4fb4-9ec4-2bfe0879dea3','f5b11308-50a9-43f3-a554-3499f8b66471','approved','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-29 15:31:37'),('c786f844-08c0-4e59-bbe5-03ec5b56b743','5fe1aab7-1b4a-47e7-a385-73b769a8557d','f5b11308-50a9-43f3-a554-3499f8b66471','started','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-30 08:26:02'),('d1602eb0-9886-441a-818a-e804fe7ca19a','2614eb9c-ded3-4503-b016-905d63c186a3','f5b11308-50a9-43f3-a554-3499f8b66471','started','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-29 04:08:34'),('d90c3830-dde6-4a5b-ae49-6d8cb101d353','6047fdc5-d1dd-4fb4-9ec4-2bfe0879dea3','f5b11308-50a9-43f3-a554-3499f8b66471','started','bf975d4b-1794-4184-aa4f-24e187b1fdc3',NULL,'2026-06-29 15:31:31');
/*!40000 ALTER TABLE `workflow_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workflow_master`
--

DROP TABLE IF EXISTS `workflow_master`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_master` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `module_name` varchar(100) NOT NULL,
  `description` text,
  `is_active` tinyint(1) DEFAULT '1',
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_workflow_module` (`module_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workflow_master`
--

LOCK TABLES `workflow_master` WRITE;
/*!40000 ALTER TABLE `workflow_master` DISABLE KEYS */;
INSERT INTO `workflow_master` VALUES ('d5a73eed-ac84-40e5-ae3e-8eed48c651d4','PR Approval (Procurement Admin)','purchase_requisition','Single-step approval by Procurement Admin',1,NULL,'2026-06-28 16:07:59','2026-06-28 16:07:59');
/*!40000 ALTER TABLE `workflow_master` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workflow_steps`
--

DROP TABLE IF EXISTS `workflow_steps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_steps` (
  `id` varchar(36) NOT NULL,
  `workflow_id` varchar(36) NOT NULL,
  `step_order` int NOT NULL,
  `step_name` varchar(255) NOT NULL,
  `approver_role` varchar(100) NOT NULL,
  `sla_hours` int DEFAULT '24',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `condition_rule` json DEFAULT NULL,
  `is_parallel` tinyint(1) NOT NULL DEFAULT '0',
  `escalation_role` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_workflow_step_order` (`workflow_id`,`step_order`),
  CONSTRAINT `workflow_steps_ibfk_1` FOREIGN KEY (`workflow_id`) REFERENCES `workflow_master` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workflow_steps`
--

LOCK TABLES `workflow_steps` WRITE;
/*!40000 ALTER TABLE `workflow_steps` DISABLE KEYS */;
INSERT INTO `workflow_steps` VALUES ('f5b11308-50a9-43f3-a554-3499f8b66471','d5a73eed-ac84-40e5-ae3e-8eed48c651d4',1,'Procurement Review','procurement_admin',24,'2026-06-28 16:07:59',NULL,0,NULL);
/*!40000 ALTER TABLE `workflow_steps` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-02 18:17:31
