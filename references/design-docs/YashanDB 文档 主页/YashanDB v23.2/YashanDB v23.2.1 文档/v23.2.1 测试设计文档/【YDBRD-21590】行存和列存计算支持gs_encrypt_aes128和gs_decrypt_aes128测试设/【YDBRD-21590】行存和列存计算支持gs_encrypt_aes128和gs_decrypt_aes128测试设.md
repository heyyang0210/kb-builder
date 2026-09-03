Created by 严丽英, last modified on 十二月 22, 2023

# 1.   **概述**

  [YDBRD-21590](https://jira.yasdb.com/browse/YDBRD-21590?src=confmacro)    **-**  **行存和列存计算支持gs_encrypt_aes128和gs_decrypt_aes128**  **完成**

  


计算支持gs_encrypt_aes128(encryptstr,keystr) gs_decrypt_aes128(decryptstr,keystr)

1. 支持加密函数gs_encrypt_aes128
1. 支持解密函数gs_decrypt_aes128
1. 两个函数使用相同的密钥进行加解密


# 2.   **需求分析**

**2.1语法图：**

### encrypt_aes128(encryptstr,keystr)

![](https://pingcode.yasdb.com/atlas/files/public/67396bc3a1ad9a3311dc8542/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQVFBQUFBQUJBQUFBQUFRQkFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY4NjIsImV4cCI6MTc4MjMwNzY2Mn0.rEkUVNi3jXO7ewocfbVOKcjUzir_eb5BisKWcGT3Ars)

### decrypt_aes128(decryptstr,keystr)

![](https://pingcode.yasdb.com/atlas/files/public/67396bc3a1ad9a3311dc8543/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQVFBQUFBQUJBQUFBQUFRQkFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY4NjIsImV4cCI6MTc4MjMwNzY2Mn0.rEkUVNi3jXO7ewocfbVOKcjUzir_eb5BisKWcGT3Ars)

  


  


**2.2 应用场景**

1. 对指定类型进行加密操作，返回加密字符串
1. 对加密字符串进行解密，返回解密出的字符串
1. 对称加解密算法


**2.3规格限制**

- 加密类型：字符串，数字类型，二进制类型中row类型，时间日期中的timestamp，date。
- 加密返回类型：字符串vachar
- 加密函数入参2个，keystr不能为null
- 解密类型：字符串varchar
- 解密输出类型：字符串varchar
- 解密函数入参2个，keystr不能为null，  解密使用的keystr密钥必须与加密时使用的keystr密钥相同才可解密出原始的明文


# 3.   **详细测试设计**

## **3.1测试设计方法**

函数入参采用边界值，等价类

其他场景采用等价类

|输入条件|有效等价|备注|无效等价|  
|
|---|---|---|---|---|
|语法|ENCRYPT_AES128(expr1,expr2)as alias,DECRYPT-AES128(expr1,expr2)as alias,ENCRYPT_AES128(expr1,expr2) alias,DECRYPT-AES128(expr1,expr2) alias,ENCRYPT_AES128(expr1,expr2) ,DECRYPT-AES128(expr1,expr2) |  
|  
|  
|
|gs_encrypt_aes128 ：入参gs_decrypt_aes128|参数个数：2个,函数大小写,函数返回  varchar,  
,gs_encrypt_aes128:,expr1 :  varchar,1.参数类型：    [数据类型转换 | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.1/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B/%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B%E8%BD%AC%E6%8D%A2.html)  ,  [heap:/nchar/nvarchar/nclob/blob/clob/bit/](http://heap/nchar/nvarchar/nclob/blob/clob/bit/)    XMLTYPE,  
,tinyint/smallint/int/bigint/float/number/double,char/varchar,date/time/timestamp/ym interval/ds interval,boolean,/raw,/json,/表达式：a+1，abs+1，,  
,2.null/为空/变量/常量/rowid/rownum,3. 最大为  varchar 32k,expr2 ：1.varchar,             2.最大为16字节，不满16字节会补空格,  
,gs_decrypt_aes128:,expr1 :1.   varchar,            2.最大为  varchar 32k,expr2 ：1.varchar,               2.最大为16字节,  
,  
|expr2:,1.当key为char(30)插入字符串不满30，会补空格填满 返回报错, 2.当key为char(16)返回成功,  
,  
,  
,  
|参数个数0-3,函数拼写错误,特殊字符,gs_encrypt_aes128:,gs_decrypt_aes128:,expr1  超过  varchar 32k, expr2 ：,1.    [heap:/nchar/nvchar/nclob/blob/clob/bit/](http://heap/nchar/nvchar/nclob/blob/clob/bit/)    XMLTYPE,tinyint/smallint/int/bigint/float/number/double,char,date/time/timestamp/ym interval/ds interval,boolean,/raw,/json,/表达式/udf/udt,plsql 绑定参数,2.null/为空/变量/常量/rowid/rownum,3.超过最大16字节,  
,  
,  
,  
,  
,  
|特殊字符：成为字符串后支持,select encrypt_aes128('@/!','123') from dual;,fail:,select encrypt_aes128(@/!,'123') from dual;|
|关键字|表名，字段名，别名|  
|  
|  
|
|plsql |绑定参数/json格式绑定参数,udf/udt|  
|  
|  
|
|  
,ddl/dml,  
|select，inster（特殊字符，||，null），update，delete,create table... select,insert...select,select into|  
|  
|  
|
|位置|group by,order by,where|  
|  
|  
|
|函数脱敏|  `1.审计`  ,  `alter `      `system`         `set unified_auditing = `      `true`      `;`  ,  `actions all; --  或者`  ,  `actions select `  ,  
,  `审计对象/审计行为:inster select  update  delete  all`  ,  `DV$AUD_UNIFIED/UNIFIED_AUDIT_TRAIL:`  ,  `select * from unified_audit_trail;`  ,2.run.log,  `AUDIT_SYS_OPERATIONS 这个参数打开 会写`      `log`      `日志（run.`      `log`      `)`      
    `alter `      `system`         `set AUDIT_SYS_OPERATIONS = `      `true`      `;`  ,3.慢日志,alter system set enable_slow_log = true;    
  alter system set SLOW_LOG_OUTPUT=table;    
  alter system set SLOW_LOG_TIME_THRESHOLD = 0;,sys.slow_log$：select SQL_TEXT from sys.slow_log$ ,  
,3.视图涉及sql_text 或者sql_fulltext字段,V$SQLTEXT/v$sql/v$sqlarea/DBA_OUTLINES/SQLMAP/V$SQLAREA/V$SQLSTATS,DV$SQLSTATS/DV$SQLAREA/DV$SQL/DV$SQLTEXT,  
|  `alter `      `system`         `set unified_auditing = `      `true`      `;`      
    `create audit policy up1 actions all; --  或者actions select 等， all代表所有`      
    `audit policy up1;`      
    `然后执行 加解密函数，  会写审计记录  （select * from unified_audit_trail;）`  ,  
,日志脱敏|  
|  
|
|where,having|>、<、>=、<=、<>、!=、between and、in/not in、like/not like、exists/not exist,and/or、group by、order by、connect by、limit/limit offset /fetch offset|  
|  
|  
|
|join|inner join、left join、righe join、full join|  
|  
|  
|
|集合|union/unionall、intersect/intersect all/minus/minus all|  
|  
|  
|
|函数嵌套|cast、CONCAT、  IFNULL 自嵌套、加解密函数之间嵌套|  
|  
|  
|
|type 返回值类型|typeof|  
|  
|  
|
|视图|v$function,dual,view/materialize view|  
|  
|  
|
|约束|access/index|  
|  
|  
|
|表类型|单机：heap、tac、lsc（分区表）临时表,分布式：tac、lsc（分区表，复制表）,集群：heap（分区表）|  
|  
|  
|
|字符集字符集|  
|  
|gbkgbk|  
|


|组合场景|gs_encrypt_aes128|gs_decrypt_aes128|
|---|---|---|
|key不同|  `encrypt_aes128(`      `'a'`      `,`      `'123'`      `);`  ,  
|  `decrypt_aes128('a','111');`  |
|key相同|  `encrypt_aes128(`      `'a'`      `,`      `'123'`      `);`  |  `decrypt_aes128('a','123');`  |
|  `decrypt为明文`  |  
|  `decrypt_aes128('a','123');`  |
|  `decrypt为密文`  |  
|  `decrypt_aes128(encrypt_aes128('a','123'),'123');`  |
|  
|  
|  
|


## 3.2     **详细测试设计**

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|DFR|否|
|HA|否|
|KT|是|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|压力|否|
|可维护性|否|
|安全|否|
|性能|否|
|长稳|否|


  


  


|dfx测试设计|  
|
|:---|:---|
|ct/kt|ddl/dml之间并发、dml/dql 之间并发|
|  
|加密数据量较大场景加密数据量较大场景|
|  
|  
|


  


# 4.   **测试用例**

1.测试设计评审时提供冒烟文本用例；

2.启动测试之前提供文本用例，并完成大部分自动化用例；

详见附件

# 5.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 确认使用的测试框架及其满足度


# 6.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|linux|
|部署|单机、集群、分布式|


  


# 7. 工作量评估

工作量：  *1人天*

计划测试完成时间：2023-11-19

## Attachments:

[加解密函数用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzM4OTcwYzJhZjRmNTIwNmNjIiwicmVmX2lkIjoiNjczOTZiYzM3MjgyMDZlZmI5MmYwOWY2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODYyLCJleHAiOjE3ODIzODMyNjJ9.79RLu4-_hWZiDPDEOU-OX1rD_D9bFDUJGActdk9N8Qk)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
