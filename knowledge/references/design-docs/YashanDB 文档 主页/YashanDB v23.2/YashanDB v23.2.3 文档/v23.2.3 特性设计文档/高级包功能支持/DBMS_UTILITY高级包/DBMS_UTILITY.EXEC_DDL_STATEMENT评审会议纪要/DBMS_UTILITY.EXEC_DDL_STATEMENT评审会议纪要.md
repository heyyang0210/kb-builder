Created by 未知用户 (liaofeng) on 十二月 11, 2023

与会人：王海峰、郝鑫刚、廖峰、张欣、王伟、邓秋怡    
  评审时间：2023.10.27  9:30am    
  评审地点：线上会议    
  评审纪要信息（方案问题或特性要求进一步调研信息，跟踪闭环后再次回复原评审邮件）：下述是主要探讨点。主要提出自测用例除了覆盖功能点本身以外，还要探讨对其他部分的影响。    
    
      sql调udf，udf调高级包，高级包内有dml,ddl。调研此时dml,ddl的编译执行情况。【DML编译但不执行，DDL编译且执行】    
      调研入参是否支持lob转成的字符串。调研udf返回的字符串当入参的情况。【和正常赋值一样支持】    
      调研varchar长度32000和sql长度2M不匹配对此需求的影响。【如果sql长度超过2M赋值给varchar变量时就已经被拦截。不会走到子函数】    
      审计是否会记录由DBMS_UTILITY.EXEC_DDL_STATEMENT执行的sql语句 【可以审计到单独的ddl sql语句,单独的非ddl无法审计到】    
      调研使用DBMS_UTILITY.EXEC_DDL_STATEMENT(sql)时，用户对此条sql的执行权限对此条子函数执行结果的影响。【用户拥有相应的执行权限才可成功执行子函数】    
      调研非ddl编译在子函数内进行编译后，v$sql表是否能查到。【查到的是整个匿名块的编译记录，没有非ddl或者ddl单独的编译记录】    
      ddl执行成功后是会默认进行commit的。调研先dml，后子函数执行ddl，ddl的commit是否会把dml也提交上。【是】    
      编译完就会有context（即使是非ddl在子函数内也要编译），代码上注意释放非ddl编译后的context。【已释放】    
    
  评审通过与否：是    
    
  调研文档链接：    [复制从 DBMS_UTILITY.EXEC_DDL_STATEMENT调研文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://mail.sics.ac.cn/redirect.php?sessid=be8a2e4c9ac615f97f5a6a093173a3b8&url=https://conf.yasdb.com/pages/viewpage.action?pageId=133579242)      
    
  设计文档链接：    [复制从 DBMS_UTILITY.EXEC_DDL_STATEMENT设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://mail.sics.ac.cn/redirect.php?sessid=be8a2e4c9ac615f97f5a6a093173a3b8&url=https://conf.yasdb.com/pages/viewpage.action?pageId=133579247)  