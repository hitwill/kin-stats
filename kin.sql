CREATE DATABASE  IF NOT EXISTS `kin` /*!40100 DEFAULT CHARACTER SET latin1 */;
USE `kin`;
-- MySQL dump 10.13  Distrib 5.7.17, for Win64 (x86_64)
--
-- Host: 92.222.155.51    Database: kin
-- ------------------------------------------------------
-- Server version	5.7.20

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `create_account`
--

DROP TABLE IF EXISTS `create_account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `create_account` (
  `hour` tinyint(3) unsigned NOT NULL COMMENT '0-23 hours in a day',
  `day` smallint(5) unsigned NOT NULL COMMENT '1-365 days in the year',
  `year` smallint(5) unsigned NOT NULL COMMENT 'YYYY',
  `quantity` smallint(6) unsigned NOT NULL DEFAULT '0' COMMENT 'number of accounts created in this period (1 hour)',
  `cursor_id` bigint(20) unsigned NOT NULL DEFAULT '0',
  `cumulative_quantity` smallint(5) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`year`,`day`,`hour`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COMMENT='Number of new accounts created over time';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`kinmetrics`@`%`*/ /*!50003 TRIGGER calCumuluativeSumInsert
    BEFORE INSERT ON create_account
    FOR EACH ROW 
BEGIN
    SET NEW.cumulative_quantity = 
      (SELECT SUM(quantity)+1 FROM create_account);
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`kinmetrics`@`%`*/ /*!50003 TRIGGER calCumuluativeSumUpdate
    BEFORE UPDATE ON create_account
    FOR EACH ROW 
BEGIN
    SET NEW.cumulative_quantity = 
      (SELECT SUM(quantity)+1 FROM create_account);
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `key_value`
--

DROP TABLE IF EXISTS `key_value`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `key_value` (
  `id` varchar(200) NOT NULL,
  `data` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COMMENT='Just hold random key value pairs for data';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pagination`
--

DROP TABLE IF EXISTS `pagination`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `pagination` (
  `cursor_type` varchar(45) NOT NULL,
  `cursor_id` bigint(20) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`cursor_type`),
  UNIQUE KEY `type_UNIQUE` (`cursor_type`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COMMENT='This just holds the most recently fetched cursor for accounts and payments';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment`
--

DROP TABLE IF EXISTS `payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payment` (
  `hour` tinyint(3) unsigned NOT NULL COMMENT '0-23 hours in a day',
  `day` smallint(5) unsigned NOT NULL COMMENT '1-365 days in the year',
  `year` smallint(5) unsigned NOT NULL COMMENT 'YYYY',
  `quantity` smallint(6) unsigned NOT NULL DEFAULT '0' COMMENT 'number of payments made in this period (1 hour)',
  `volume` double unsigned NOT NULL DEFAULT '0' COMMENT 'volume of payments made in this period (1 hour)',
  `cursor_id` bigint(20) unsigned NOT NULL DEFAULT '0',
  `cumulative_quantity` smallint(5) unsigned NOT NULL DEFAULT '0',
  `account_id_from` char(56) DEFAULT NULL COMMENT 'This just holds the most recent account id that was updated. A trigger will pull the id from this table into user_activity',
  `account_id_to` char(56) DEFAULT NULL,
  PRIMARY KEY (`year`,`day`,`hour`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COMMENT='Volume of Kin transacted over time';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`kinmetrics`@`%`*/ /*!50003 TRIGGER calCumuluativeSumInsertPayment
    BEFORE INSERT ON payment
    FOR EACH ROW 
BEGIN
    SET NEW.cumulative_quantity = 
      (SELECT SUM(quantity)+1 FROM payment);
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`kinmetrics`@`%`*/ /*!50003 TRIGGER userActivityInsert
    AFTER INSERT ON payment
    FOR EACH ROW 
BEGIN
	INSERT INTO user_activity SET account_id = NEW.account_id_from
    ON duplicate key update last_active = NOW();
    INSERT INTO user_activity SET account_id = NEW.account_id_to
    ON duplicate key update last_active = NOW();
      
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`kinmetrics`@`%`*/ /*!50003 TRIGGER calCumuluativeSumUpdatePayment
    BEFORE UPDATE ON payment
    FOR EACH ROW 
BEGIN
    SET NEW.cumulative_quantity = 
      (SELECT SUM(quantity)+1 FROM payment);
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`kinmetrics`@`%`*/ /*!50003 TRIGGER userActivityUpdate
    AFTER UPDATE ON payment
    FOR EACH ROW 
BEGIN
	INSERT INTO user_activity SET account_id = NEW.account_id_from
    ON duplicate key update last_active = NOW();
    INSERT INTO user_activity SET account_id = NEW.account_id_to
    ON duplicate key update last_active = NOW();
      
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `user_activity`
--

DROP TABLE IF EXISTS `user_activity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_activity` (
  `account_id` char(56) NOT NULL,
  `last_active` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COMMENT='Hold activity of individual users';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2018-07-11 15:42:01
