Created by 马士杰, last modified on 七月 18, 2024

# 1. 需求概述

  [https://pingcode.yasdb.com/pjm/items/66191514fd997db58ad89285](https://pingcode.yasdb.com/pjm/items/66191514fd997db58ad89285)    ?    
  #YDBRD-26278 兼容MySQL Set语句

语法兼容，以下Set语句    
  【USE Statement】    
  （2）SET character_set_results = NULL     
  （3）SET SESSION     
  3.1 SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ    
  3.2 SET SESSION character_set_results     
  3.3 SET SESSION NET_READ_TIMEOUT= 86400    
  3.4 SET SESSION NET_WRITE_TIMEOUT= 86400    
  3.5 SET SQL_QUOTE_SHOW_CREATE=1    
  3.7 SET SESSION WAIT_TIMEOUT = 2147483    
  3.8 SET SESSION NET_WRITE_TIMEOUT = 2147483    
  3.9 SET SESSION SQL_LOG_BIN = 0    
  （4）SET SQL_SELECT_LIMIT=200     
  （5）SET foreign_key_checks = 1     
  （7）SET NAMES utf8mb4

# 2. 友商的实现情况

1、mysql set语法

SET variable = expr [, variable = expr] ...

variable: {    
  user_var_name    
  | param_name    
  | local_var_name    
  | {GLOBAL | @@GLOBAL.} system_var_name    
  | [SESSION | @@SESSION. | @@] system_var_name    
  }

  


# 3.规格限制

NET_READ_TIMEOUT 1~31536000

NET_WRITE_TIMEOUT 1~31536000

SQL_QUOTE_SHOW_CREATE 0 1

WAIT_TIMEOUT 1-2147483

SQL_LOG_BIN 0 1

SQL_SELECT_LIMIT = {  *value*     | DEFAULT}

FOREIGN_KEY_CHECKS = {0 | 1}

NAMES {'  *charset_name*  ' | DEFAULT}