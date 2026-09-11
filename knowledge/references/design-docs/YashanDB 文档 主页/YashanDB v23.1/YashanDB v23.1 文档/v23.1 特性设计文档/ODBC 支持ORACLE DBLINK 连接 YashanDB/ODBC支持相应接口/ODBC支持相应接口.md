Created by 冯皓博, last modified on 六月 29, 2023

#   [YDBRD-15359](https://jira.yasdb.com/browse/YDBRD-15359?src=confmacro)    -  【C驱动】支持yacGetData接口  完成

# 1、ODBC新增接口和表现：

|接口|调用宏|说明|情况|实际值|
|---|---|---|---|---|
|SQLGetInfo|SQL_CATALOG_NAME|CATALOG ISO-92要求，但目前不支持|√|Y|
|  
|SQL_MAX_CATALOG_NAME_LEN|CATALOG ISO-92要求，但目前不支持|√|204|
|  
|SQL_TXN_CAPABLE|待确定|√|SQL_TC_DDL_COMMIT|
|  
|SQL_CURSOR_COMMIT_BEHAVIOR|待确定|√|SQL_CB_PRESERVE|
|  
|SQL_CURSOR_ROLLBACK_BEHAVIOR|待确定|√|SQL_CB_PRESERVE|
|SQLBindParameter|  
|不支持非prepare后绑定，可整改|√|  
|
|SQLBindCol|  
|不支持非Exec后绑定，可整改|√|  
|
|SQLGetTypeInfo|  
|不支持|√|具体结果集见此处文末：,  [SQLGetTypeInfo - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/SQLGetTypeInfo)  |
|SQLColAttribute|SQL_DESC_UNSIGNED|不支持|√|switch (sqlType) {    
  case SQL_NUMERIC:    
  case SQL_TINYINT:    
  case SQL_SMALLINT:    
  case SQL_INTEGER:    
  case SQL_BIGINT:    
  case SQL_REAL:    
  case SQL_DOUBLE:    
  case SQL_INTERVAL_YEAR_TO_MONTH:    
  case SQL_INTERVAL_DAY_TO_SECOND:    
  return SQL_TRUE;    
  default:    
  return SQL_FALSE;    
  }|
|SQLTables|  
|不支持|√|  
|
|SQLSetStmtAttr|SQL_ATTR_ROW_STATUS_PTR|不支持|√|使用方法见MR用例  testRowStatus  ：,  [Dblink support zhuance (!45) · 合并请求 · CoD-X / yasdb-odbc · GitLab](https://git.yasdb.com/cod-x/yasdb-odbc/-/merge_requests/45)  |


遗留项：

确认SQLGetTypeInfo的类型属性结果集是否准确