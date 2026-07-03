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
-- Dumping routines for database 'vendor_portal'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-02 18:17:15
