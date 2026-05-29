-- MySQL dump 10.13  Distrib 8.4.7, for macos15 (arm64)
--
-- Host: 127.0.0.1    Database: vendor_portal
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
INSERT INTO `asn_line_items` VALUES ('1ebd559d-3426-4c6f-8ef9-2da3e079d0c5','97a4c689-5606-4d3a-aa04-5854a2566a73','c4fca2fd-15de-4d7a-9f33-9ac0a169eab4',1,'CNC Machine Parts',5.000,100000.00),('264e94c7-5b4d-4aca-bbf7-e7acf138f0e9','aa081113-da3e-4cbf-84a3-e16ddc1e3e18','f7fa877f-d26b-441d-b9dc-6f4692e922ff',1,'Labdanum Gum 5/10% Batch N o :L-6295 Mig Date: 06.08.2025 Re-Test Date :06.08.20',1.000,6210.00),('364597c9-4a90-43e2-b1ad-deb474907cc8','3e708f7c-7573-43f6-907b-7b9f245646a1','0047eaad-7878-49bc-b7ce-927ed3230836',1,'Steel Rods 8mm',120.000,60000.00),('52d77615-c70e-4448-8f71-7b56a146be2c','f19608b3-e87f-4739-9c56-5712692ec197','2346a422-8a01-422e-b3a8-f6245a19a2b5',1,'Welding Electrodes',300.000,30000.00),('6be5846a-7bdc-46ac-838d-cbc5cfe84b19','b5602fd7-847d-4022-b39b-9f7b7e497410','f7fa877f-d26b-441d-b9dc-6f4692e922ff',1,'Labdanum Gum 5/10% Batch N o :L-6295 Mig Date: 06.08.2025 Re-Test Date :06.08.20',49.000,304290.00),('856f882f-8a26-474d-9575-aa8e04740db2','97a4c689-5606-4d3a-aa04-5854a2566a73','814fc19b-3cca-4fb8-8349-80c048d13bfc',2,'Hydraulic Pumps',2.000,60000.00),('859dbd54-8bbe-474d-a2a2-aa1600ee4467','19b54214-2545-44a0-8f93-92ba9fc0eb48','c4fca2fd-15de-4d7a-9f33-9ac0a169eab4',1,'CNC Machine Parts',1.000,20000.00),('8c2fcc10-480a-45d7-89e1-b5a04a0ae808','8f4137ac-6207-4a5d-8c23-cbf272eacc7b','c4fca2fd-15de-4d7a-9f33-9ac0a169eab4',1,'CNC Machine Parts',1.000,20000.00),('8fa63a25-2054-4f90-9555-4ba84d0e1ccf','fb47b7ca-d06d-4913-acd6-a354498e104d','c4fca2fd-15de-4d7a-9f33-9ac0a169eab4',1,'CNC Machine Parts',1.000,20000.00),('9f994126-843d-4bf6-96fb-35735af212ea','43ec9274-730c-4b02-a660-dc21f3fab6fd','217348a8-a21b-4772-aab6-5e99161320c9',1,'Chemical Solvent X',240.000,48000.00),('befe06ed-bc73-48d7-85f7-73d8216b3533','02b7864a-838c-4e5e-b4e8-10105e3e353a','0047eaad-7878-49bc-b7ce-927ed3230836',1,'Steel Rods 8mm',120.000,60000.00),('cbe925cc-2f58-41ab-8e00-8a713be2797e','d3b6b1f9-e52a-4f46-adc4-272e41589af9','b92b28c5-cba0-43af-a219-e760620d9a43',1,'Software License Annual',1.000,200000.00),('d27bae87-6b40-4b16-818b-f4794368dd0d','01c55745-d0fd-4ed0-bb89-ae7d47b63560','814fc19b-3cca-4fb8-8349-80c048d13bfc',1,'Hydraulic Pumps',3.000,90000.00),('e729840d-d1fe-4a31-aeb5-834f80482b6c','a2f38114-32df-4a34-8be9-13b880f0449a','c4fca2fd-15de-4d7a-9f33-9ac0a169eab4',1,'CNC Machine Parts',1.000,20000.00),('ebf5ae6d-a217-488f-9345-ac142f3bb11c','cee45c8f-3f01-4317-bca3-7d52567ec4a6','c4fca2fd-15de-4d7a-9f33-9ac0a169eab4',1,'CNC Machine Parts',1.000,20000.00);
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_invoice_number` (`invoice_number`),
  UNIQUE KEY `asn_number` (`asn_number`),
  KEY `po_id` (`po_id`),
  KEY `idx_vendor_asn` (`vendor_id`),
  KEY `idx_status_asn` (`status`),
  CONSTRAINT `asns_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`),
  CONSTRAINT `asns_ibfk_2` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asns`
--

LOCK TABLES `asns` WRITE;
/*!40000 ALTER TABLE `asns` DISABLE KEYS */;
INSERT INTO `asns` VALUES ('01c55745-d0fd-4ed0-bb89-ae7d47b63560','ASN-HYD450','cc5d6246-4b15-48de-85e6-1161646ffa1c','95c13922-8a08-4aa6-a3e6-f9a7ce5dce93','2026-06-17','INV-2024-5001',200000.00,NULL,'LR-55001','Safexpress','Ravi Verma',NULL,NULL,NULL,NULL,'submitted',NULL,NULL,NULL,NULL,'2026-05-25 18:49:29','2026-05-26 05:07:33'),('02b7864a-838c-4e5e-b4e8-10105e3e353a','ASN-21J936','482f60e5-f695-48f1-b2c5-f2f35e8cec25','12159c9a-e7eb-4b56-a8df-2c56f97acd8e','2026-06-15','INV-2024-1001',150000.00,NULL,'LR-78901','Blue Dart Express','Ramesh Kumar',NULL,NULL,NULL,NULL,'posted',NULL,NULL,'posted','Successfully Posted','2026-05-25 18:49:29','2026-05-25 18:49:29'),('19b54214-2545-44a0-8f93-92ba9fc0eb48','ASN-MPMGFP13','cc5d6246-4b15-48de-85e6-1161646ffa1c','95c13922-8a08-4aa6-a3e6-f9a7ce5dce93','2026-05-28','224356',12456.00,NULL,'3456','raja','raja',NULL,NULL,NULL,NULL,'rejected',NULL,NULL,NULL,NULL,'2026-05-26 09:50:30','2026-05-26 09:53:08'),('3e708f7c-7573-43f6-907b-7b9f245646a1','ASN-3YH7ZT','482f60e5-f695-48f1-b2c5-f2f35e8cec25','12159c9a-e7eb-4b56-a8df-2c56f97acd8e','2026-06-02','INV-2024-1002',100000.00,NULL,'LR-78902','Delhivery','Suresh Patel',NULL,NULL,NULL,NULL,'posted',NULL,NULL,'posted','Successfully Posted','2026-05-25 18:49:29','2026-05-26 05:34:30'),('43ec9274-730c-4b02-a660-dc21f3fab6fd','ASN-LAUE2P','93bac638-d7b8-419a-8a89-e03b9c6eb4ad','714869ef-3b3a-4027-a2d9-4770e91470e8','2026-06-04','INV-2024-2001',100000.00,NULL,'LR-88001','DTDC Logistics','Anil Sharma',NULL,NULL,NULL,NULL,'submitted',NULL,NULL,NULL,NULL,'2026-05-25 18:49:29','2026-05-25 18:49:29'),('8f4137ac-6207-4a5d-8c23-cbf272eacc7b','ASN-MPM78MB2','cc5d6246-4b15-48de-85e6-1161646ffa1c','95c13922-8a08-4aa6-a3e6-f9a7ce5dce93','2026-05-30','478787',120000.00,NULL,'787888','raja transport','raja',NULL,NULL,NULL,NULL,'posted',NULL,NULL,'posted','Successfully Posted','2026-05-26 05:33:03','2026-05-26 09:53:31'),('97a4c689-5606-4d3a-aa04-5854a2566a73','ASN-MPM5A7TO','cc5d6246-4b15-48de-85e6-1161646ffa1c','95c13922-8a08-4aa6-a3e6-f9a7ce5dce93','2026-05-29','87878989',120000.00,NULL,'3455','Raghu','raja','345666',NULL,NULL,NULL,'submitted',NULL,NULL,NULL,NULL,'2026-05-26 04:38:19','2026-05-26 05:07:33'),('a2f38114-32df-4a34-8be9-13b880f0449a','ASN-MPM611CG','cc5d6246-4b15-48de-85e6-1161646ffa1c','95c13922-8a08-4aa6-a3e6-f9a7ce5dce93','2026-05-28','3488898',1200.00,NULL,'878898','raja','raja',NULL,NULL,NULL,NULL,'submitted',NULL,NULL,NULL,NULL,'2026-05-26 04:59:10','2026-05-26 05:07:33'),('aa081113-da3e-4cbf-84a3-e16ddc1e3e18','ASN-MPQG0M4M','5dc455e7-7743-473b-a265-c4b397975533','873f754f-007a-4d43-95ec-4e4cf95c79be','2026-05-30','43456',12000.00,NULL,'89898','raja','raja',NULL,NULL,NULL,NULL,'validated',NULL,NULL,NULL,NULL,'2026-05-29 04:49:51','2026-05-29 04:50:07'),('b5602fd7-847d-4022-b39b-9f7b7e497410','ASN-MPQIIAP3','5dc455e7-7743-473b-a265-c4b397975533','873f754f-007a-4d43-95ec-4e4cf95c79be','2026-05-30','INV-34788',12000.00,NULL,'787788','raja','raja',NULL,NULL,NULL,NULL,'posted',NULL,NULL,'posted','Successfully Posted','2026-05-29 05:59:35','2026-05-29 06:00:32'),('cee45c8f-3f01-4317-bca3-7d52567ec4a6','ASN-MPM65B72','cc5d6246-4b15-48de-85e6-1161646ffa1c','95c13922-8a08-4aa6-a3e6-f9a7ce5dce93','2026-05-28','234889',2344.00,NULL,'2345','raja','raja',NULL,NULL,NULL,NULL,'posted',NULL,NULL,'posted','Successfully Posted','2026-05-26 05:02:29','2026-05-26 05:08:32'),('d3b6b1f9-e52a-4f46-adc4-272e41589af9','ASN-LS67PS','bf22e8cb-da54-4a92-9727-ff922105f233','eba0b5a2-8e30-4b28-a9d5-ae9b58992308','2026-06-18','INV-2024-3001',300000.00,NULL,'LR-99001','FedEx India','Vijay Singh',NULL,NULL,NULL,NULL,'posted',NULL,NULL,'posted','Successfully Posted','2026-05-25 18:49:29','2026-05-25 18:49:29'),('f19608b3-e87f-4739-9c56-5712692ec197','ASN-L0S9RM','482f60e5-f695-48f1-b2c5-f2f35e8cec25','2084ae3a-5c35-4773-a40c-dad9fb95100e','2026-06-03','INV-2024-1003',50000.00,NULL,'LR-78903','Gati Ltd','Mohan Das',NULL,NULL,NULL,NULL,'validated',NULL,NULL,NULL,NULL,'2026-05-25 18:49:29','2026-05-26 05:04:04'),('fb47b7ca-d06d-4913-acd6-a354498e104d','ASN-MPQIFMGT','cc5d6246-4b15-48de-85e6-1161646ffa1c','95c13922-8a08-4aa6-a3e6-f9a7ce5dce93','2026-05-31','7888',120000.00,NULL,'56778','raja','raja',NULL,NULL,NULL,NULL,'posted',NULL,NULL,'posted','Successfully Posted','2026-05-29 05:57:31','2026-05-29 06:00:13');
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
INSERT INTO `audit_checklist_items` VALUES ('0f214f3e-f8ba-4ea9-909a-a5baf963ae6d','5f098fc5-fd76-44b5-a3b0-5d61a1e6b5f1','Quality control process documented',2),('1716ca3b-96f6-4f1c-8277-d6753cf616bd','5f098fc5-fd76-44b5-a3b0-5d61a1e6b5f1','Corrective action process defined',5),('20f9abe3-651f-4d79-9f56-e2c9025e41d1','5f098fc5-fd76-44b5-a3b0-5d61a1e6b5f1','Non-conformance tracking system',4),('2541be14-6b49-48e7-8a1d-c34908b206dd','5f098fc5-fd76-44b5-a3b0-5d61a1e6b5f1','Incoming material inspection in place',3),('3682addc-5e0e-467f-8791-7334ac6ee7c9','5f098fc5-fd76-44b5-a3b0-5d61a1e6b5f1','ISO 9001 certification valid',1);
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
INSERT INTO `audit_checklists` VALUES ('5f098fc5-fd76-44b5-a3b0-5d61a1e6b5f1','Quality Compliance Audit','Standard quality compliance checklist for all Tier 1 suppliers','Quality',NULL,1,'2026-05-26 15:03:59');
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
INSERT INTO `audit_executions` VALUES ('22e79fc3-9e61-4bb7-ba25-0611065dd5cb','bb9968d9-d39e-4ee1-95e8-d2293ac4a9e6','closed','2026-05-29 06:04:35','2026-05-29 06:06:33','72130729-78dc-49af-a622-eff761274e65'),('3bbfa0b1-67b5-4dec-aa4d-5dd988543a38','c8cac12f-a9d1-45ad-ba72-351fd67010e2','planned','2026-06-07 18:30:00',NULL,NULL),('44ce3832-543a-44ad-8e0e-8af0b6fefe7a','c8cac12f-a9d1-45ad-ba72-351fd67010e2','in_progress','2026-05-26 19:07:50',NULL,'72130729-78dc-49af-a622-eff761274e65'),('496d3f7f-871c-4929-a085-116693c1da94','cd6555ef-99ca-451c-a276-9ac60ca9f276','closed','2026-05-26 15:52:34','2026-05-26 16:10:50','72130729-78dc-49af-a622-eff761274e65'),('5897df3e-5919-439a-a927-45c61b64ec56','7b902b78-7217-4304-89d1-276407a8b152','closed','2026-05-26 15:34:43','2026-05-26 16:11:03','72130729-78dc-49af-a622-eff761274e65'),('d2c1e1f8-94ca-412f-9c6e-f7b40a1bd55b','c8cac12f-a9d1-45ad-ba72-351fd67010e2','completed','2026-05-26 17:38:33','2026-05-26 17:38:47','72130729-78dc-49af-a622-eff761274e65'),('f63b4011-577c-4845-bcc8-08b3db6b8539','c8cac12f-a9d1-45ad-ba72-351fd67010e2','planned','2026-06-14 18:30:00',NULL,NULL),('f817e34f-e71c-4c07-8b60-72d5a258db39','c8cac12f-a9d1-45ad-ba72-351fd67010e2','planned','2026-05-31 18:30:00',NULL,NULL);
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
INSERT INTO `audit_findings` VALUES ('00756712-98f4-4a22-a38a-82f3e3e9e4ef','496d3f7f-871c-4929-a085-116693c1da94','check','low','closed',NULL,'2026-05-26 16:10:48','2026-05-26 15:53:12'),('24e16ae3-0d66-4749-8a25-be93c3338fce','496d3f7f-871c-4929-a085-116693c1da94','check','medium','closed',NULL,'2026-05-26 16:10:46','2026-05-26 15:54:53'),('9552d8bf-efcc-4ed9-a1fd-758c28fac744','496d3f7f-871c-4929-a085-116693c1da94','air problem','high','closed',NULL,'2026-05-26 16:10:23','2026-05-26 16:02:16'),('b22ec96f-45b9-4631-98f5-99553449a1cc','496d3f7f-871c-4929-a085-116693c1da94','verify','high','closed',NULL,'2026-05-26 16:10:28','2026-05-26 15:55:12'),('bce3d3b2-4b43-4b6e-a483-33e83e058c0f','22e79fc3-9e61-4bb7-ba25-0611065dd5cb','Validate 2 days after this scenario again','medium','closed',NULL,'2026-05-29 06:06:21','2026-05-29 06:05:23'),('e223cbe8-b597-4664-9771-069609ce3469','496d3f7f-871c-4929-a085-116693c1da94','water problem','high','closed',NULL,'2026-05-26 16:10:26','2026-05-26 16:02:07'),('f3e67df0-4d14-4910-98a1-13920952f8c7','22e79fc3-9e61-4bb7-ba25-0611065dd5cb','They have to submit document','high','closed',NULL,'2026-05-29 06:06:19','2026-05-29 06:05:43');
/*!40000 ALTER TABLE `audit_findings` ENABLE KEYS */;
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
INSERT INTO `audit_responses` VALUES ('08b07eda-5182-4496-b044-2acb6d868858','496d3f7f-871c-4929-a085-116693c1da94','2541be14-6b49-48e7-8a1d-c34908b206dd','yes',NULL),('08c0c8c5-79a0-420d-903e-2449ac008bb2','496d3f7f-871c-4929-a085-116693c1da94','20f9abe3-651f-4d79-9f56-e2c9025e41d1','yes',NULL),('0f5d3098-dac2-490c-81ca-422015bc9ef1','496d3f7f-871c-4929-a085-116693c1da94','2541be14-6b49-48e7-8a1d-c34908b206dd','yes',NULL),('18d0cc40-2e2e-4ebe-bcea-1e359bf223f2','496d3f7f-871c-4929-a085-116693c1da94','20f9abe3-651f-4d79-9f56-e2c9025e41d1','yes',NULL),('2703a4e8-7594-466b-bc24-5c2c3c235df2','496d3f7f-871c-4929-a085-116693c1da94','3682addc-5e0e-467f-8791-7334ac6ee7c9','yes',NULL),('2f0cb604-4f74-4ddd-9e3c-e329f27820fd','496d3f7f-871c-4929-a085-116693c1da94','1716ca3b-96f6-4f1c-8277-d6753cf616bd','yes',NULL),('3cc6583b-40ee-4bbb-9b13-b52b682f7b96','d2c1e1f8-94ca-412f-9c6e-f7b40a1bd55b','20f9abe3-651f-4d79-9f56-e2c9025e41d1','na',NULL),('56b9aec1-8551-4700-a861-e477ea4592e5','d2c1e1f8-94ca-412f-9c6e-f7b40a1bd55b','2541be14-6b49-48e7-8a1d-c34908b206dd','na',NULL),('68135322-ae76-41bc-8055-1c51258e9625','22e79fc3-9e61-4bb7-ba25-0611065dd5cb','20f9abe3-651f-4d79-9f56-e2c9025e41d1','yes',NULL),('732b4d24-bd6b-49f1-8d55-77970b8f4742','22e79fc3-9e61-4bb7-ba25-0611065dd5cb','0f214f3e-f8ba-4ea9-909a-a5baf963ae6d','no','it may not be revenant to this vendor'),('78a005e9-21ab-4d4e-acfe-7741c8e2e6d4','496d3f7f-871c-4929-a085-116693c1da94','3682addc-5e0e-467f-8791-7334ac6ee7c9','yes',NULL),('7df4affd-279d-489d-b16c-b6970aad1ed4','496d3f7f-871c-4929-a085-116693c1da94','1716ca3b-96f6-4f1c-8277-d6753cf616bd','yes',NULL),('939c3c80-450d-4f9e-aea1-b4f7b1c38a09','d2c1e1f8-94ca-412f-9c6e-f7b40a1bd55b','0f214f3e-f8ba-4ea9-909a-a5baf963ae6d','na',NULL),('99151cb0-e5df-439f-a468-b93ac413464a','22e79fc3-9e61-4bb7-ba25-0611065dd5cb','3682addc-5e0e-467f-8791-7334ac6ee7c9','yes',NULL),('a4dba870-47d8-4624-998c-eaf03e89ab9c','496d3f7f-871c-4929-a085-116693c1da94','0f214f3e-f8ba-4ea9-909a-a5baf963ae6d','yes',NULL),('a9063f98-4e02-4028-91cf-8345afaaac96','22e79fc3-9e61-4bb7-ba25-0611065dd5cb','2541be14-6b49-48e7-8a1d-c34908b206dd','yes',NULL),('ac7a7f70-96dd-4cca-9c77-7b71d2c5d71c','d2c1e1f8-94ca-412f-9c6e-f7b40a1bd55b','1716ca3b-96f6-4f1c-8277-d6753cf616bd','na',NULL),('bc599965-089e-482d-80b7-8052f983aff9','496d3f7f-871c-4929-a085-116693c1da94','0f214f3e-f8ba-4ea9-909a-a5baf963ae6d','yes',NULL),('e6253a21-c181-4c41-a6b9-f35daa73155f','22e79fc3-9e61-4bb7-ba25-0611065dd5cb','1716ca3b-96f6-4f1c-8277-d6753cf616bd','yes',NULL),('f6abe996-53d5-477b-84c8-9b1183db0b13','d2c1e1f8-94ca-412f-9c6e-f7b40a1bd55b','3682addc-5e0e-467f-8791-7334ac6ee7c9','na',NULL);
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
INSERT INTO `audit_schedules` VALUES ('1d72a552-f964-4ba2-9ea8-583561c7b465','5f098fc5-fd76-44b5-a3b0-5d61a1e6b5f1','1b694e8b-81cd-4fa7-a891-1954e629c7b5',NULL,'monthly','2026-05-28',NULL,1,0,'2026-05-28',NULL,'planned','72130729-78dc-49af-a622-eff761274e65','2026-05-26 17:22:29'),('7b902b78-7217-4304-89d1-276407a8b152','5f098fc5-fd76-44b5-a3b0-5d61a1e6b5f1','482f60e5-f695-48f1-b2c5-f2f35e8cec25',NULL,'monthly','2026-05-27',NULL,1,0,'2026-05-27','2026-05-26','completed','72130729-78dc-49af-a622-eff761274e65','2026-05-26 15:34:38'),('bb9968d9-d39e-4ee1-95e8-d2293ac4a9e6','5f098fc5-fd76-44b5-a3b0-5d61a1e6b5f1','522169f2-0088-495a-89c4-827edfcce0a3',NULL,'one_time','2026-05-29','2026-05-30',1,0,'2026-05-29','2026-05-29','completed','72130729-78dc-49af-a622-eff761274e65','2026-05-29 06:04:22'),('c8cac12f-a9d1-45ad-ba72-351fd67010e2','5f098fc5-fd76-44b5-a3b0-5d61a1e6b5f1','87a95c19-d66d-4d90-9de5-9bab677e2707',NULL,'weekly','2026-06-01','2026-06-30',5,0,'2026-06-01','2026-05-27','in_progress','72130729-78dc-49af-a622-eff761274e65','2026-05-26 17:38:13'),('cd6555ef-99ca-451c-a276-9ac60ca9f276','5f098fc5-fd76-44b5-a3b0-5d61a1e6b5f1','10893e82-4e16-47a6-a320-7fcc29b49bd2',NULL,'one_time','2026-05-29',NULL,1,0,'2026-05-29','2026-05-26','completed','72130729-78dc-49af-a622-eff761274e65','2026-05-26 15:52:31');
/*!40000 ALTER TABLE `audit_schedules` ENABLE KEYS */;
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
INSERT INTO `extraction_configs` VALUES ('0a1813db-9305-4890-bce7-f0b590a77f60','Total Amount','[\"total amount\", \"total\", \"grand total\", \"net amount\", \"amount payable\"]','[\\d,]+\\.?\\d*','high',1,'2026-05-25 18:28:22','2026-05-25 18:28:22'),('0b3a4b95-60d3-422c-833f-707f6cbf3a0e','Invoice Date','[\"invoice date\", \"inv date\", \"date\", \"bill date\"]','\\d{2}[/\\-]\\d{2}[/\\-]\\d{4}','high',1,'2026-05-25 18:28:22','2026-05-25 18:28:22'),('0c60fd20-49f2-4f74-8e5b-1b527240ecae','Quantity','[\"quantity\", \"qty\", \"total qty\", \"units\"]','\\d+','low',1,'2026-05-25 18:49:29','2026-05-25 18:49:29'),('16799690-cc09-44d2-abda-00565ad21463','Test Field','[\"test\", \"tst\"]','[0-9]+','high',1,'2026-05-26 10:10:03','2026-05-26 10:10:03'),('170b785f-c2b5-4460-822f-e8ed64ada771','GST Number','[\"gstin\", \"gst no\", \"gst number\"]','[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}','medium',1,'2026-05-25 18:28:22','2026-05-25 18:28:22'),('911ab3ad-f30a-43e6-bc7f-b3a3ede2a541','Invoice Number','[\"invoice number\", \"invoice no\", \"inv no\", \"inv. no\", \"bill no\"]','[A-Z0-9\\-/]+','high',1,'2026-05-25 18:28:22','2026-05-25 18:28:22'),('e44ffedd-add0-46e3-9588-38f44a319e55','PO Number','[\"po number\", \"purchase order\", \"po no\", \"po #\", \"order number\"]','PO[\\-/]?\\d+','medium',1,'2026-05-25 18:49:29','2026-05-25 18:49:29');
/*!40000 ALTER TABLE `extraction_configs` ENABLE KEYS */;
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
INSERT INTO `po_line_items` VALUES ('0047eaad-7878-49bc-b7ce-927ed3230836','12159c9a-e7eb-4b56-a8df-2c56f97acd8e',2,'Steel Rods 8mm',NULL,200.000,NULL,500.00,100000.00,0.00,0.00,NULL,120.000),('1b5b62ca-4f93-4df8-ab62-543d16110e88','12159c9a-e7eb-4b56-a8df-2c56f97acd8e',1,'Steel Plates 10mm',NULL,100.000,NULL,1500.00,150000.00,0.00,0.00,NULL,0.000),('217348a8-a21b-4772-aab6-5e99161320c9','714869ef-3b3a-4027-a2d9-4770e91470e8',2,'Chemical Solvent X',NULL,400.000,NULL,200.00,80000.00,0.00,0.00,NULL,0.000),('2346a422-8a01-422e-b3a8-f6245a19a2b5','2084ae3a-5c35-4773-a40c-dad9fb95100e',1,'Welding Electrodes',NULL,500.000,NULL,100.00,50000.00,0.00,0.00,NULL,0.000),('3c3ac824-6086-4bd0-b196-82d0de0f0d88','714869ef-3b3a-4027-a2d9-4770e91470e8',1,'Polymer Granules Grade A',NULL,500.000,NULL,200.00,100000.00,0.00,0.00,NULL,0.000),('814fc19b-3cca-4fb8-8349-80c048d13bfc','95c13922-8a08-4aa6-a3e6-f9a7ce5dce93',2,'Hydraulic Pumps',NULL,4.000,NULL,30000.00,120000.00,0.00,0.00,NULL,0.000),('9bbc7d9b-6455-4dc3-bfc3-b6babf175163','2084ae3a-5c35-4773-a40c-dad9fb95100e',2,'Safety Equipment',NULL,50.000,NULL,500.00,25000.00,0.00,0.00,NULL,0.000),('b92b28c5-cba0-43af-a219-e760620d9a43','eba0b5a2-8e30-4b28-a9d5-ae9b58992308',2,'Software License Annual',NULL,1.000,NULL,200000.00,200000.00,0.00,0.00,NULL,0.000),('bd1c9002-9984-47d0-90fb-f90ab12461d5','eba0b5a2-8e30-4b28-a9d5-ae9b58992308',1,'IT Consulting Services',NULL,1.000,NULL,300000.00,300000.00,0.00,0.00,NULL,0.000),('c4fca2fd-15de-4d7a-9f33-9ac0a169eab4','95c13922-8a08-4aa6-a3e6-f9a7ce5dce93',1,'CNC Machine Parts',NULL,10.000,NULL,20000.00,200000.00,0.00,0.00,NULL,3.000),('f7fa877f-d26b-441d-b9dc-6f4692e922ff','873f754f-007a-4d43-95ec-4e4cf95c79be',1,'Labdanum Gum 5/10% Batch N o :L-6295 Mig Date: 06.08.2025 Re-Test Date :06.08.20','38069090',350.000,'KGS',6210.00,2173500.00,18.00,391230.00,2564730.00,49.000);
/*!40000 ALTER TABLE `po_line_items` ENABLE KEYS */;
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
  PRIMARY KEY (`id`),
  KEY `vendor_id` (`vendor_id`),
  KEY `idx_item` (`item_description`(100)),
  CONSTRAINT `price_history_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `price_history`
--

LOCK TABLES `price_history` WRITE;
/*!40000 ALTER TABLE `price_history` DISABLE KEYS */;
INSERT INTO `price_history` VALUES ('21dc6c12-8b04-49fb-a4bf-6393ed94c760','Software License Annual','bf22e8cb-da54-4a92-9727-ff922105f233','eba0b5a2-8e30-4b28-a9d5-ae9b58992308',200000.00,1.000,'2026-05-26 15:03:59'),('5d63ba7a-0a57-4d87-9fed-b2e03a32195d','CNC Machine Parts','cc5d6246-4b15-48de-85e6-1161646ffa1c','95c13922-8a08-4aa6-a3e6-f9a7ce5dce93',20000.00,10.000,'2026-05-26 15:03:59'),('73092b77-b464-4fb2-a6e2-166c5a0d3621','Steel Plates 10mm','482f60e5-f695-48f1-b2c5-f2f35e8cec25','12159c9a-e7eb-4b56-a8df-2c56f97acd8e',1500.00,100.000,'2026-05-26 15:03:59'),('805ff59c-084a-4ffe-a2f3-4e75fec4f710','Hydraulic Pumps','cc5d6246-4b15-48de-85e6-1161646ffa1c','95c13922-8a08-4aa6-a3e6-f9a7ce5dce93',30000.00,4.000,'2026-05-26 15:03:59'),('86574f20-3022-4cb0-8ae5-d3fbfe4332ee','Steel Rods 8mm','482f60e5-f695-48f1-b2c5-f2f35e8cec25','12159c9a-e7eb-4b56-a8df-2c56f97acd8e',500.00,200.000,'2026-05-26 15:03:59'),('95c7cfd2-5944-483b-96a8-5cbf1b8ee442','Chemical Solvent X','93bac638-d7b8-419a-8a89-e03b9c6eb4ad','714869ef-3b3a-4027-a2d9-4770e91470e8',200.00,400.000,'2026-05-26 15:03:59'),('ad131a24-7381-46db-a590-b9eea8bb752e','IT Consulting Services','bf22e8cb-da54-4a92-9727-ff922105f233','eba0b5a2-8e30-4b28-a9d5-ae9b58992308',300000.00,1.000,'2026-05-26 15:03:59'),('b41a9031-654b-4809-ba0f-c023c60cc629','Welding Electrodes','482f60e5-f695-48f1-b2c5-f2f35e8cec25','2084ae3a-5c35-4773-a40c-dad9fb95100e',100.00,500.000,'2026-05-26 15:03:59'),('dfa3d170-d80a-49f4-83e7-b9dd97f9772e','Safety Equipment','482f60e5-f695-48f1-b2c5-f2f35e8cec25','2084ae3a-5c35-4773-a40c-dad9fb95100e',500.00,50.000,'2026-05-26 15:03:59'),('ed2e6934-01b6-4a10-afdf-6c66799011ff','Polymer Granules Grade A','93bac638-d7b8-419a-8a89-e03b9c6eb4ad','714869ef-3b3a-4027-a2d9-4770e91470e8',200.00,500.000,'2026-05-26 15:03:59');
/*!40000 ALTER TABLE `price_history` ENABLE KEYS */;
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `po_number` (`po_number`),
  KEY `idx_vendor` (`vendor_id`),
  CONSTRAINT `purchase_orders_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_orders`
--

LOCK TABLES `purchase_orders` WRITE;
/*!40000 ALTER TABLE `purchase_orders` DISABLE KEYS */;
INSERT INTO `purchase_orders` VALUES ('12159c9a-e7eb-4b56-a8df-2c56f97acd8e','PO-2024-001',NULL,'482f60e5-f695-48f1-b2c5-f2f35e8cec25',NULL,NULL,NULL,NULL,NULL,250000.00,NULL,NULL,'open','2026-05-25 18:49:29','2026-05-25 18:49:29'),('2084ae3a-5c35-4773-a40c-dad9fb95100e','PO-2024-004',NULL,'482f60e5-f695-48f1-b2c5-f2f35e8cec25',NULL,NULL,NULL,NULL,NULL,75000.00,NULL,NULL,'open','2026-05-25 18:49:29','2026-05-25 18:49:29'),('714869ef-3b3a-4027-a2d9-4770e91470e8','PO-2024-002',NULL,'93bac638-d7b8-419a-8a89-e03b9c6eb4ad',NULL,NULL,NULL,NULL,NULL,180000.00,NULL,NULL,'open','2026-05-25 18:49:29','2026-05-25 18:49:29'),('873f754f-007a-4d43-95ec-4e4cf95c79be','JCEPL/DGL/PUR/4520041534/25-26','2026-03-25','5dc455e7-7743-473b-a265-c4b397975533','Jasmine Concrete Exports Pvt Ltd','00% EOU (Export Oriented Unit), 604/6:Jallipattipirivu, ambudurai Kottai, Village Dindigul','33AAACJ1788R1Z0','Tamil Nadu','33',2564730.00,'30 days','2026-06-30','open','2026-05-28 11:04:10','2026-05-28 11:04:10'),('95c13922-8a08-4aa6-a3e6-f9a7ce5dce93','PO-2024-005',NULL,'cc5d6246-4b15-48de-85e6-1161646ffa1c',NULL,NULL,NULL,NULL,NULL,320000.00,NULL,NULL,'open','2026-05-25 18:49:29','2026-05-25 18:49:29'),('eba0b5a2-8e30-4b28-a9d5-ae9b58992308','PO-2024-003',NULL,'bf22e8cb-da54-4a92-9727-ff922105f233',NULL,NULL,NULL,NULL,NULL,500000.00,NULL,NULL,'open','2026-05-25 18:49:29','2026-05-25 18:49:29');
/*!40000 ALTER TABLE `purchase_orders` ENABLE KEYS */;
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
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sub_masters`
--

LOCK TABLES `sub_masters` WRITE;
/*!40000 ALTER TABLE `sub_masters` DISABLE KEYS */;
INSERT INTO `sub_masters` VALUES ('0b9f478e-df81-4d0d-81ba-e4a9a9e857e5','city','Pune',NULL,1,'2026-05-25 18:28:22'),('10f2e47d-be0f-4943-affb-4f14bd0b76cb','state','Tamil Nadu',NULL,1,'2026-05-25 18:28:22'),('1f47dacc-3855-4c42-a69a-bddb19c704ee','company','Serene Technology',NULL,1,'2026-05-25 18:28:22'),('2260b051-3f98-40b5-9563-57f354ef7c38','city','Hyderabad',NULL,1,'2026-05-25 18:49:29'),('23daa4ba-8143-41dd-988a-da387699b859','company','ABC Corp',NULL,1,'2026-05-25 18:28:22'),('24531129-9ba6-4fd5-9d67-3fc88d09fec2','supplier_category','Tier 1',NULL,1,'2026-05-25 18:28:22'),('2ce0bcbb-6a73-4f83-9d5f-b12479bcb9c4','city','Delhi',NULL,1,'2026-05-25 18:28:22'),('32d4fc7b-6b04-45f3-a15f-38751e50c554','supplier_category','Tier 3',NULL,1,'2026-05-25 18:28:22'),('3bf5e777-3906-4aa7-b298-95270495e43a','supplier_group','Services',NULL,1,'2026-05-25 18:28:22'),('4804fd3f-6ba8-49d6-b70b-da045930e9ed','company','Global Traders',NULL,1,'2026-05-25 18:49:29'),('4c973938-e50f-41b8-975c-11484fda7613','department','Logistics',NULL,1,'2026-05-25 18:49:29'),('4d4148ef-b4a3-4b4c-ac13-4b0056eb7825','state','Karnataka',NULL,1,'2026-05-25 18:28:22'),('5d2f0a8a-f777-4879-a28f-8ed8a3d1fae3','city','Ahmedabad',NULL,1,'2026-05-25 18:28:22'),('612cf92b-0939-4051-8210-a69616106a8c','department','Operations',NULL,1,'2026-05-25 18:28:22'),('624541c1-1344-453b-9dc9-e874b79bc234','city','Chennai',NULL,1,'2026-05-25 18:28:22'),('67ee806f-a43b-47e8-ba30-79f2fe6df1e3','supplier_category','Tier 2',NULL,1,'2026-05-25 18:28:22'),('78387f73-fec8-47fd-b6ba-e2c5e8aa588b','state','Gujarat',NULL,1,'2026-05-25 18:28:22'),('7fe22a1f-05e7-4ee9-a7ea-b20fcc0e7a84','state','Delhi',NULL,1,'2026-05-25 18:28:22'),('81ad1574-f8e4-4754-971a-7df5d00853c0','supplier_group','Packaging',NULL,1,'2026-05-25 18:49:29'),('8f5555c2-ccd0-4c79-ab4f-092b67607d7e','department','Procurement',NULL,1,'2026-05-25 18:28:22'),('916439f8-a9da-4adf-82c1-005b8035b1e3','country','India',NULL,1,'2026-05-25 18:28:22'),('95f6d5f5-9beb-4f78-95a5-f84858cfd5f5','city','Jaipur',NULL,1,'2026-05-25 18:49:29'),('a21ee077-995b-4517-bc9c-05e0d53595ab','country','UK',NULL,1,'2026-05-25 18:49:29'),('b884c52b-7438-4f0a-af9d-f6575bfbe137','company','XYZ Industries',NULL,1,'2026-05-25 18:28:22'),('cc881085-3c6e-449f-bcb2-7d45380219c7','department','Finance',NULL,1,'2026-05-25 18:28:22'),('dd8625b3-7683-4fab-a2a0-2fac5507c294','supplier_group','Equipment',NULL,1,'2026-05-25 18:28:22'),('e45e6c71-83c6-413e-a1b7-0af721f8ea29','city','Bangalore',NULL,1,'2026-05-25 18:28:22'),('f008595f-5470-471a-b256-a62b1ad6d7ba','state','Maharashtra',NULL,1,'2026-05-25 18:28:22'),('f29592ff-d5d7-4c43-8ca0-c07e985fbeba','state','Rajasthan',NULL,1,'2026-05-25 18:49:29'),('f59425e8-62f7-4256-9679-ec941ce1d816','country','USA',NULL,1,'2026-05-25 18:49:29'),('f7088190-a052-4705-9b13-d2e144a39990','city','Mumbai',NULL,1,'2026-05-25 18:28:22'),('fcea1f26-b0ad-4b6b-a131-8f0927777493','supplier_group','Raw Materials',NULL,1,'2026-05-25 18:28:22');
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
INSERT INTO `system_settings` VALUES ('10c82e27-7019-450a-af62-21d08ed60e25','modules_risk','true','2026-05-26 15:03:59'),('1ce957f1-c8b4-4a84-a579-b3bbf0ef61b1','modules_ticketing','true','2026-05-26 15:03:59'),('3830764b-e3af-4f27-9082-c8f3c641dafc','modules_esg','true','2026-05-26 15:03:59'),('520dcd18-c27a-4035-9ee3-d67f824332db','modules_pricing','true','2026-05-26 15:03:59'),('876fc665-7683-476c-b082-9155adad5ab7','module_mode','advanced','2026-05-26 15:03:59'),('a99f3078-da37-437a-b53d-e14b6e09fda4','modules_audit','true','2026-05-26 15:03:59');
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
INSERT INTO `ticket_vendors` VALUES ('bc2af3d2-abbe-4011-a5c9-028c757a52e2','1ec8c7fb-e25b-4904-9563-3e988c6ccc5f','482f60e5-f695-48f1-b2c5-f2f35e8cec25','open',NULL,NULL);
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `ticket_number` (`ticket_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tickets`
--

LOCK TABLES `tickets` WRITE;
/*!40000 ALTER TABLE `tickets` DISABLE KEYS */;
INSERT INTO `tickets` VALUES ('1ec8c7fb-e25b-4904-9563-3e988c6ccc5f','TKT-0001','Delayed shipment for PO-2024-001','Shipment was expected on 15th but not received. Please provide update.','high','initiated',NULL,NULL,NULL,'2026-05-26 15:03:59',NULL);
/*!40000 ALTER TABLE `tickets` ENABLE KEYS */;
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
INSERT INTO `users` VALUES ('2ae2d703-f4db-4e82-bbc1-3030781a38fd','sample@sample.com','$2b$10$R3COgwtoAfTdaev0UL6dT.Ds.T5Cb38TObETCD7GL9neMUcIQWgFe','vendor','5dc455e7-7743-473b-a265-c4b397975533',1,'INDENTA CHEMICALS INDIA PVT.LTD.',1,'2026-05-28 10:23:22','2026-05-28 10:23:22'),('383082dc-585a-4f48-946c-c8801b0d2bdc','ravi@ravi.com','$2b$10$rw5GJajA7.JmKqg.jf4Q2efY1fNoefAervE.tCzqhcynpQJTs7UlO','vendor','522169f2-0088-495a-89c4-827edfcce0a3',1,'Ravi Automobiles',1,'2026-05-29 05:39:57','2026-05-29 05:39:57'),('680c0e96-9aed-40ae-8c91-081d793ddc41','vendor3@infosys.com','$2b$10$vu2U3TujQIkIKmyD.2RD5uF8mAk2mJA6gpnn2nnseMbJ7V2XCfAz6','vendor','482f60e5-f695-48f1-b2c5-f2f35e8cec25',0,'Infosys Technologies',1,'2026-05-25 18:49:29','2026-05-25 18:49:29'),('6e9d77f6-0c34-4dfa-8b40-e93573cc0382','vendor8@lnt.com','$2b$10$zIoJ2F7Np26hM6LNutsea.P3W6RqQkqehpHW1kik8GUZIMhM9Dv6C','vendor','bf22e8cb-da54-4a92-9727-ff922105f233',0,'Larsen & Toubro',1,'2026-05-25 18:49:29','2026-05-25 18:49:29'),('6ecfa9c9-23ac-47d5-95a9-fc9d11fed388','sri@gmail.com','$2b$10$bJxHv0sBUeuJbfZg6fYaaev8a/Hj/mNRzzRao0/vnVO1OB4QlWiou','vendor','3d1c69f9-de73-463e-ba11-5aa53628d269',1,'sri',1,'2026-05-26 04:10:48','2026-05-26 04:10:48'),('72130729-78dc-49af-a622-eff761274e65','procurement@vendorportal.com','$2b$10$Va.NWtDzSUtN/kNPXqns8uxmDJkBfax13iVxRWDy/s99INHN42Qou','procurement_admin',NULL,0,'Procurement Admin',1,'2026-05-25 18:28:22','2026-05-25 18:28:22'),('900ffd29-9757-4027-a43f-a8156ed0a025','vendor5@hinpack.com','$2b$10$d0TYL3G2u6CS2Px0GqmQr.PJCtBKj6IzeAdiKXYS.8cvU5cOYdYdW','vendor','10893e82-4e16-47a6-a320-7fcc29b49bd2',0,'Hindustan Packaging',1,'2026-05-25 18:49:29','2026-05-25 18:49:29'),('95b902b4-da42-4180-b3c2-820a97234268','vendor6@bel.com','$2b$10$6EC3ceXltvO/COxPoleY9O3F/.RRZKgV70dRusthe601RH9b3Ts2i','vendor','1b694e8b-81cd-4fa7-a891-1954e629c7b5',0,'Bharat Electronics',1,'2026-05-25 18:49:29','2026-05-25 18:49:29'),('aa98c762-7774-4fcb-80a4-d550d6d26b4f','sysadmin@procuretrack.com','$2b$12$Ro9EOFDmK2OXSIOHbcHyPOTvzZNKkK8szavYIp5tuXi3KNlzGrwc2','system_admin',NULL,0,'System Administrator',1,'2026-05-26 15:03:59','2026-05-26 15:03:59'),('aac04255-efde-4a8a-924e-cf2335e09025','vendor1@tatasteel.com','$2b$10$X0BGHMiG/4bSys5H35KzOurb.Fe/TkB4vlz4Y3pcffsiU//Rut4o6','vendor','cc5d6246-4b15-48de-85e6-1161646ffa1c',0,'Tata Steel Ltd',1,'2026-05-25 18:49:29','2026-05-25 18:49:29'),('bf6fd99e-0c7d-4c0e-ae78-601cf0d66d05','vendor4@mahindra.com','$2b$10$8TwFI522A9LSUU5hhfgzsOpN8fHf9qGP66HwzQEBwjm5ho5sjW1Qi','vendor','87a95c19-d66d-4d90-9de5-9bab677e2707',0,'Mahindra Logistics',1,'2026-05-25 18:49:29','2026-05-25 18:49:29'),('d1a9226e-75c9-4d5a-a529-5b989d6dd497','admin@vendorportal.com','$2b$10$vi/leflQa4b62IeKf4T6c.RHXEdkrx/Qs9nlaV/fO3nRbLqDZoqJW','mdm_admin',NULL,0,'System Admin',1,'2026-05-25 18:28:22','2026-05-25 18:28:22'),('f1f787bb-98ea-461a-a244-3798820b7f20','vendor2@reliance.com','$2b$10$4Oi01G4NuSoVPAKqzHy5qeN6J0/4fdKdI0kRYRTwXZRYApl2CAU52','vendor','93bac638-d7b8-419a-8a89-e03b9c6eb4ad',0,'Reliance Industries',1,'2026-05-25 18:49:29','2026-05-25 18:49:29'),('fad57c08-488a-4935-beff-5302c0cbe8c2','vendor7@godrej.com','$2b$10$P6CmjeY5Pr4rH73TMu7/nuxK2pxvLJ2ugVEA0kfUrextBjP8fbX.m','vendor','534734a4-fe06-4292-9eb3-17b6cd712579',0,'Godrej Industries',1,'2026-05-25 18:49:29','2026-05-25 18:49:29');
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
INSERT INTO `vendor_addresses` VALUES ('1e5f3d2e-b5b7-47b6-ad36-b9a740ca6c76','bf22e8cb-da54-4a92-9727-ff922105f233','456 Warehouse Complex','Sector 5','Mumbai','Maharashtra','India','400002','[\"shipping\"]','2026-05-25 18:49:29'),('1f0eae00-011c-4400-935e-b4a80e399db8','cc5d6246-4b15-48de-85e6-1161646ffa1c','123 Industrial Area, Phase 2','Near Highway Junction','Mumbai','Maharashtra','India','400001','[\"billing\", \"registered\"]','2026-05-26 04:36:31'),('3878253c-3384-4e68-b568-8cf39006900d','cc5d6246-4b15-48de-85e6-1161646ffa1c','456 Warehouse Complex','Sector 5','Mumbai','Maharashtra','India','400002','[\"shipping\"]','2026-05-26 04:36:31'),('5e205afe-c6b6-4a48-8c03-f4c6ed3a75d5','93bac638-d7b8-419a-8a89-e03b9c6eb4ad','456 Warehouse Complex','Sector 5','Mumbai','Maharashtra','India','400002','[\"shipping\"]','2026-05-25 18:49:29'),('aba8d348-ad4e-4737-8b8e-5cb28787d07f','5dc455e7-7743-473b-a265-c4b397975533','117,The Summit Business Bay,Nr.WEH Metro Station Opp.Cinemax Theatre,Off.Sir M.V.Road','Andheri (East)','Mumbai','Maharashtra','India','400093','[\"billing\", \"shipping\", \"registered\"]','2026-05-28 10:25:03'),('b0883b94-1eb4-4ef8-8512-b430a2487448','482f60e5-f695-48f1-b2c5-f2f35e8cec25','123 Industrial Area, Phase 2','Near Highway Junction','Bangalore','Maharashtra','India','400001','[\"billing\", \"registered\"]','2026-05-25 18:49:29'),('cf3c3859-711e-4c7d-a267-7221968795ca','93bac638-d7b8-419a-8a89-e03b9c6eb4ad','123 Industrial Area, Phase 2','Near Highway Junction','Mumbai','Maharashtra','India','400001','[\"billing\", \"registered\"]','2026-05-25 18:49:29'),('da553484-3706-4d8c-a83f-134a596be3b8','bf22e8cb-da54-4a92-9727-ff922105f233','123 Industrial Area, Phase 2','Near Highway Junction','Mumbai','Maharashtra','India','400001','[\"billing\", \"registered\"]','2026-05-25 18:49:29'),('f4692608-596d-4ad7-b75c-8e37052c6dd1','482f60e5-f695-48f1-b2c5-f2f35e8cec25','456 Warehouse Complex','Sector 5','Bangalore','Maharashtra','India','400002','[\"shipping\"]','2026-05-25 18:49:29');
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
INSERT INTO `vendor_bank_accounts` VALUES ('125a8d90-5b60-4f46-92f4-dae89058e8e1','cc5d6246-4b15-48de-85e6-1161646ffa1c','SBIN0001234','123456789062','Tata Steel Ltd','State Bank of India','Main Branch','Mumbai','Maharashtra','India','2026-05-26 04:36:31'),('7147c3c1-e633-4352-bf3c-f8a6be53a215','482f60e5-f695-48f1-b2c5-f2f35e8cec25','SBIN0001234','123456789019','Infosys Technologies','State Bank of India','Main Branch','Bangalore','Maharashtra','India','2026-05-25 18:49:29'),('cb54d8a9-eadc-4ead-bf5e-482f04f73991','bf22e8cb-da54-4a92-9727-ff922105f233','SBIN0001234','123456789065','Larsen & Toubro','State Bank of India','Main Branch','Mumbai','Maharashtra','India','2026-05-25 18:49:29'),('dab5e0b1-dbeb-42a8-9b81-80a1a24a8cf8','93bac638-d7b8-419a-8a89-e03b9c6eb4ad','SBIN0001234','123456789061','Reliance Industries','State Bank of India','Main Branch','Mumbai','Maharashtra','India','2026-05-25 18:49:29');
/*!40000 ALTER TABLE `vendor_bank_accounts` ENABLE KEYS */;
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
INSERT INTO `vendor_esg` VALUES ('3a019b8d-4edf-4c90-a2ca-66bf8d747f43','482f60e5-f695-48f1-b2c5-f2f35e8cec25',0,'compliant','Standard compliance',NULL,'2026-05-26 15:03:59'),('42293b82-f8f7-43c4-82b8-60bffde5ac8f','bf22e8cb-da54-4a92-9727-ff922105f233',1,'compliant','MSME certified, women-led enterprise',NULL,'2026-05-26 15:03:59'),('70d92454-00a4-4a6a-ac19-37ddb9ea089d','cc5d6246-4b15-48de-85e6-1161646ffa1c',0,'compliant','Standard compliance',NULL,'2026-05-26 15:03:59'),('a241979a-4ba4-481a-b129-98a8974a1c0e','93bac638-d7b8-419a-8a89-e03b9c6eb4ad',1,'compliant','MSME certified, women-led enterprise',NULL,'2026-05-26 15:03:59');
/*!40000 ALTER TABLE `vendor_esg` ENABLE KEYS */;
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
INSERT INTO `vendor_risk_scores` VALUES ('39e59fe3-27ee-4fc6-950b-82dd9efa0f4a','482f60e5-f695-48f1-b2c5-f2f35e8cec25',7.00,'low',18.00,0.00,1.00,'2026-05-26 15:03:59'),('6d3f613c-e337-4930-b554-ddfef26a1cbd','bf22e8cb-da54-4a92-9727-ff922105f233',14.00,'low',14.00,11.00,18.00,'2026-05-26 15:03:59'),('b1371a49-4e41-4122-bdfd-3f56081ce6ce','93bac638-d7b8-419a-8a89-e03b9c6eb4ad',7.00,'low',7.00,11.00,0.00,'2026-05-26 15:03:59'),('f87fd678-7eaf-4aef-8d99-ce7af1d898ec','cc5d6246-4b15-48de-85e6-1161646ffa1c',22.00,'low',25.00,23.00,16.00,'2026-05-26 15:03:59');
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `vendor_number` (`vendor_number`),
  KEY `idx_status` (`status`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendors`
--

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
INSERT INTO `vendors` VALUES ('10893e82-4e16-47a6-a320-7fcc29b49bd2','VND-UWENL5','Hindustan Packaging','vendor5@hinpack.com','9876543214','Serene Technology','Operations','Packaging','Tier 2','Chennai','approved',NULL,'33AABCH9012D1Z8','AABCH9012D','Hindustan Packaging','Hindustan Packaging Pvt Ltd',NULL,NULL,NULL,NULL,NULL,NULL,'d1a9226e-75c9-4d5a-a529-5b989d6dd497','2026-05-25 18:49:29','2026-05-29 05:51:44'),('1b694e8b-81cd-4fa7-a891-1954e629c7b5','VND-BM5F5D','Bharat Electronics','vendor6@bel.com','9876543215','ABC Corp','Procurement','Equipment','Tier 1','Bangalore','draft',NULL,NULL,NULL,'Bharat Electronics','Bharat Electronics Pvt Ltd',NULL,NULL,NULL,NULL,NULL,NULL,'d1a9226e-75c9-4d5a-a529-5b989d6dd497','2026-05-25 18:49:29','2026-05-25 18:49:29'),('3d1c69f9-de73-463e-ba11-5aa53628d269','VND-MPM4AUFU','sri','sri@gmail.com','8787878778','Global Traders','Logistics','Packaging','Tier 1','madurai','draft',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'d1a9226e-75c9-4d5a-a529-5b989d6dd497','2026-05-26 04:10:48','2026-05-26 04:10:48'),('482f60e5-f695-48f1-b2c5-f2f35e8cec25','VND-D3PVM1','Infosys Technologies','vendor3@infosys.com','9876543212','XYZ Industries','Finance','Services','Tier 1','Bangalore','approved',NULL,'29AABCI1234B1Z6','AABCI1234B','Infosys Technologies','Infosys Technologies Pvt Ltd',NULL,NULL,NULL,NULL,NULL,NULL,'d1a9226e-75c9-4d5a-a529-5b989d6dd497','2026-05-25 18:49:29','2026-05-25 18:49:29'),('522169f2-0088-495a-89c4-827edfcce0a3','VND-MPQHT1SL','Ravi Automobiles','ravi@ravi.com','89898','Global Traders','Operations','Packaging','Tier 2','Madurai','draft',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'d1a9226e-75c9-4d5a-a529-5b989d6dd497','2026-05-29 05:39:57','2026-05-29 05:39:57'),('534734a4-fe06-4292-9eb3-17b6cd712579','VND-J3NBD6','Godrej Industries','vendor7@godrej.com','9876543216','XYZ Industries','Finance','Raw Materials','Tier 2','Mumbai','rejected','Incomplete GST documentation. Please re-upload valid GST certificate and resubmit.','27AABCG3456E1Z9','AABCG3456E','Godrej Industries','Godrej Industries Pvt Ltd',NULL,NULL,NULL,NULL,NULL,NULL,'d1a9226e-75c9-4d5a-a529-5b989d6dd497','2026-05-25 18:49:29','2026-05-25 18:49:29'),('5dc455e7-7743-473b-a265-c4b397975533','VND-MPPCHO7Z','INDENTA CHEMICALS INDIA PVT.LTD.','sample@sample.com','89789898','Global Traders','Procurement','Raw Materials','Tier 2','Maharashtra','draft',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'d1a9226e-75c9-4d5a-a529-5b989d6dd497','2026-05-28 10:23:22','2026-05-28 10:23:22'),('87a95c19-d66d-4d90-9de5-9bab677e2707','VND-64IGZI','Mahindra Logistics','vendor4@mahindra.com','9876543213','Global Traders','Logistics','Services','Tier 2','Pune','submitted',NULL,'27AABCM5678C1Z7','AABCM5678C','Mahindra Logistics','Mahindra Logistics Pvt Ltd',NULL,NULL,NULL,NULL,NULL,NULL,'d1a9226e-75c9-4d5a-a529-5b989d6dd497','2026-05-25 18:49:29','2026-05-25 18:49:29'),('93bac638-d7b8-419a-8a89-e03b9c6eb4ad','VND-OUW4SW','Reliance Industries','vendor2@reliance.com','9876543211','ABC Corp','Operations','Raw Materials','Tier 1','Mumbai','approved',NULL,'27AABCR1234A1Z5','AABCR1234A','Reliance Industries','Reliance Industries Pvt Ltd',NULL,NULL,NULL,NULL,NULL,NULL,'d1a9226e-75c9-4d5a-a529-5b989d6dd497','2026-05-25 18:49:29','2026-05-25 18:49:29'),('bf22e8cb-da54-4a92-9727-ff922105f233','VND-NWE85T','Larsen & Toubro','vendor8@lnt.com','9876543217','Global Traders','Operations','Equipment','Tier 1','Mumbai','approved',NULL,'27AABCL7890F1Z0','AABCL7890F','Larsen & Toubro','Larsen & Toubro Pvt Ltd',NULL,NULL,NULL,NULL,NULL,NULL,'d1a9226e-75c9-4d5a-a529-5b989d6dd497','2026-05-25 18:49:29','2026-05-25 18:49:29'),('cc5d6246-4b15-48de-85e6-1161646ffa1c','VND-QYNAQU','Tata Steel Ltd','vendor1@tatasteel.com','9876543210','Serene Technology','Procurement','Raw Materials','Tier 1','Mumbai','approved',NULL,'27AAACT2727Q1ZV','AAACT2727Q','Tata Steel Ltd','Tata Steel Ltd Pvt Ltd','small','filed','8788989',NULL,NULL,NULL,'d1a9226e-75c9-4d5a-a529-5b989d6dd497','2026-05-25 18:49:29','2026-05-26 04:36:31');
/*!40000 ALTER TABLE `vendors` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-29 11:53:31
