Created by 高亚宁, last modified by  陈瑞 on 十一月 09, 2023

# **1. 概述**

本文描述集群支持表对象及基本DDL测试设计

SR:     [[YDBRD-13434] 【共享集群】集群支持索引 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13434?filter=-1)  

开发设计：    [集群支持非ONLINE索引 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=107384390)  

# **2. 需求分析**

**2.1 功能特性**

1. 集群下某个实例执行create/drop/alter index，其他实例能感知到ddl产生的影响
1. 支持多实例的create/drop/alter index并发(通过Gls X lock实现)，  当执行节点完成后，需要广播同步其他节点失效dc的操作，使其他节点在重新访问table时重新加载dc使index生效


**2.2 功能限制**

ONLINE索引不支持

列式索引不支持

# **3. 测试**  **设计方法**   

1. Rac部署形态；
1. 语法功能：create、alter、drop index语法及功能测试，重点校验一个实例执行，在其他实例上：    

    1. 被优化器使用：创建索引成功后，插入数据，select 查询，验证索引扫描算子是否生效，查询数据正常
    1. 创建约束using index 使用索引生效
    1. 创建约束触发索引升级生效
    1. 执行 create、alter、drop index生效
1. 多实例间并发： 
    1. create、alter、drop index 并发  ，  校验功能的正确性
    1. create、alter、drop index 与 dml 并发
1. 一致性：使用一致性新框架，覆盖旧旧用例
1. testkill：
    1. create、alter、drop index时，本实例或其他实例kill重启
    1. create、alter、drop 与 dml 并发
1.  约束限制。不支持online索引/列式缩影


主要采用场景法、正交法进行测试

  


### 3.3专项覆盖

|专项|是否涉及|说明|
|:---|:---|---|
|并发|涉及|  
|
|长稳|不涉及|  
|
|一致性|涉及|  
|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|  
|
|安全|不涉及|  
|
|DFR/testkill|涉及|  
|
|HA|不涉及|  
|
|压力|不涉及|  
|
|性能|不涉及|  
|
|可维护性|不涉及|  
|
|兼容性|不涉及|  
|


# 4.   **详细测试设计**   

4.1.语法功能

create index

|一级分类|二级分类|三级分类|支持情况|
|:---|:---|:---|:---|
|UNIQUE|  
|  
|  
|
|COLUMNAR|  
|  
|不支持|
|schema. index_name|  
|  
|  
|
|index_expr|DESC|  
|  
|
|  
|ASC|  
|  
|
|index_attr_clause|TABLESPACE|tablespace_name|  
|
|  
|  
|DEFAULT|默认|
|  
|INITRANS integer|  
|  
|
|  
|PCTFREE integer|  
|  
|
|  
|storage_clause|  
|  
|
|  
|VISIBLE|INVISIBLE|  
|  
|
|  
|USABLE|UNUSABLE|  
|  
|
|  
|local_index_clause|hash_partition_clause|  
|
|  
|  
|none_hash_partition_clause|  
|
|  
|ONLINE|  
|不支持|
|  
|PARALLEL|NOPARALLEL|  
|  
|
|  
|NOCOMPRESS|COMPRESS|  
|  
|
|  
|LOGGING|NOLOGGING|  
|  
|
|  
|NOREVERSE|REVERSE|  
|  
|
|  
|readonly_clause|  
|  
|
|  
|READONLY | READWRITE|  
|  
|
|  
|inmemory_clause|  
|  
|
|  
|INMEMORY | NO INMEMORY|  
|  
|
|  
|global|  
|无意义，省略默认为global|


  


4.2.alter index

|一级分类|二级分类|分布式支持情况|备注|
|:---|:---|:---|:---|
|  
,```
<span class="token rule">schema.</span>
```|  
|  
|  
|
|INITRANS integer|  
|  
|  
|
|VISIBLE|  
|  
|  
|
|INVISIBLE|  
|  
|  
|
|UNUSABLE|  
|  
|  
|
|COALESCE|  
|  
|  
|
|NOPARALLEL|  
|  
|  
|
|PARALLEL integer|  
|  
|  
|
|modify_partition|INITRANS integer|  
|  
|
|  
|UNUSABLE|  
|  
|
|  
|COALESCE|  
|  
|
|rebuild_clause|TABLESPACE tablespace_name|  
|  
|
|  
|INITRANS integer|  
|  
|
|  
|PCTFREE integer|  
|  
|
|  
|ONLINE|  
|不支持|
|  
|NOCOMPRESS|  
|  
|
|  
|COMPRESS (integer)|  
|  
|
|  
|logging|  
|  
|
|  
|nologging|  
|  
|
|  
|NOREVERSE|  
|  
|
|  
|REVERSE|  
|  
|
|  
|NOPARALLEL|  
|  
|
|  
|PARALLEL integer|  
|  
|


  


4.4、函数索引支持的函数列表

|内置函数|VOLATILE|支持用于创建函数索引|
|:---|:---|:---|
|ABS|N|Y|
|ACOS|N|Y|
|ADD_MONTHS|Y|N|
|AGE|Y|N|
|ARRAY_APPEND|N|Y|
|ARRAY_LENGTH|N|Y|
|ARRAY_NDIMS|N|Y|
|ARRAY_POSITION|N|Y|
|ARRAY_REMOVE|N|Y|
|ARRAY_REPLACE|N|Y|
|ARRAY_TO_STRING|N|Y|
|ARRAY_UPPER|N|Y|
|ASCII|N|Y|
|ASIN|N|Y|
|ATAN|N|Y|
|ATAN2|N|Y|
|AVG|N|N|
|BIN|N|Y|
|BIN_TO_NUM|N|Y|
|BITAND BITOR BITXOR|N|Y|
|BIT_LENGTH|N|Y|
|CAST|N|Y|
|CEIL|N|Y|
|CHAR_LENGTH CHARACTER_LENGTH|N|Y|
|CHECK_SYS_PRIVILEGE|N|Y|
|CHR|N|Y|
|COALESCE|N|Y|
|CONCAT|N|Y|
|CONCAT_WS|N|Y|
|COS|N|Y|
|COT|N|Y|
|COUNT|N|N|
|CURRENT_TIMESTAMP|Y|N|
|DATE|N|Y|
|DATE_ADD|N|Y|
|DATE_FORMAT|N|N|
|DAYOFWEEK|Y|N|
|DECODE|N|Y|
|DIV|N|Y|
|EXP|N|Y|
|EXTRACT|N|Y|
|FIND_IN_SET|N|Y|
|FIRST_VALUE|N|Y|
|FLOOR|N|N|
|GREATEST|N|Y|
|GROUP_CONCAT|N|N|
|HEXTORAW|N|N|
|IF|N|Y|
|IFNULL|N|Y|
|INITCAP|N|Y|
|INSTR|N|Y|
|ISNULL|N|Y|
|JSON|N|Y|
|JSON_ARRAY_GET|N|Y|
|JSON_ARRAY_LENGTH|N|Y|
|JSON_EXISTS|N|Y|
|JSON_QUERY|N|Y|
|JSON_SERIALIZE|N|Y|
|LAG|N|N|
|LAST_DAY|N|Y|
|LAST_VALUE|N|N|
|LEAD|N|N|
|LEAST|N|Y|
|LEFT|N|Y|
|LENGTH LENGTHB|N|Y|
|LISTAGG|N|N|
|LN|N|Y|
|LNNVL|N|Y|
|LOCALTIME|Y|N|
|LOCALTIMESTAMP|Y|N|
|LOG|N|Y|
|LOWER|N|Y|
|LPAD|N|Y|
|LTRIM|N|N|
|MAX|N|N|
|MIN|N|N|
|MOD|N|Y|
|MONTHS_BETWEEN|Y|N|
|NEXT_DAY|Y|N|
|NLSSORT|N|N|
|NOW|Y|N|
|NULLIF|N|Y|
|NUMTODSINTERVAL|N|Y|
|NUMTOYMINTERVAL|N|Y|
|NVL|N|Y|
|NVL2|N|Y|
|OCTET_LENGTH|N|Y|
|PI|N|Y|
|POSITION|N|Y|
|POW POWER|N|Y|
|RANDOM|Y|N|
|RANK|N|N|
|REGEXP_COUNT|N|Y|
|REGEXP_INSTR|N|Y|
|REGEXP_LIKE|N|Y|
|REGEXP_REPLACE|N|N|
|REGEXP_SUBSTR|N|N|
|REPLACE|N|N|
|RIGHT|N|Y|
|ROUND|N|Y|
|ROW_NUMBER|N|N|
|RPAD|N|Y|
|RTRIM|N|N|
|SCN_TO_TIMESTAMP|Y|N|
|SIGN|N|Y|
|SIN|N|Y|
|SINH|N|Y|
|SPLIT|N|Y|
|SQLCODE|N|N|
|SQLERRM|N|N|
|SQRT|N|Y|
|STDDEV|N|N|
|STDDEV_POP|N|N|
|STDDEV_SAMP|N|N|
|STRING_AGG|N|N|
|STRING_TO_ARRAY|N|Y|
|STRPOS|N|Y|
|SUBSTR|N|Y|
|SUBSTRING|N|Y|
|SUBSTRING_INDEX|N|Y|
|SUM|N|N|
|SYSDATE|Y|N|
|SYSTIMESTAMP|Y|N|
|SYS_CONNECT_BY_PATH|N|N|
|SYS_CONTEXT|Y|N|
|TAN|N|Y|
|TANH|N|Y|
|TIME|N|Y|
|TIMEDIFF|N|Y|
|TIMESTAMP|N|Y|
|TIMESTAMPDIFF|Y|N|
|TIMESTAMP_TO_SCN|Y|N|
|TO_CHAR|N|Y|
|TO_DATE|Y|部分支持|
|TO_DSINTERVAL|N|Y|
|TO_NUMBER|N|Y|
|TO_TIMESTAMP|Y|部分支持|
|TO_YMINTERVAL|N|Y|
|TRANSLATE|N|N|
|TRIM|N|Y|
|TRUNC|N|Y|
|TYPEOF|N|Y|
|UPPER|N|Y|
|USERENV|Y|N|
|UTC_TIMESTAMP|N|Y|
|VARIANCE|N|N|
|VAR_POP|N|N|
|VAR_SAMP|N|N|
|WM_CONCATABS|N|N|


# 5.   **测试用例**

  


# 6.   **测试框架设计**

1、功能自动化用例添加到yasft：特性分类 ddl_01，已有特性下用例执行时间5m55s

2、HA相关自动化用例添加到HA自动化用例

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[image2023-4-20_16-8-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTlhMWFkOWEzMzExZGM3ODM2IiwicmVmX2lkIjoiNjczOTY5YTk3MjgyMDZlZmI5MmVmNWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjM5LCJleHAiOjE3ODIyOTQ2Mzl9.hAjj4tNRd0z-S4KQd5Ob37mjG_asRvxfpy71-LG1G6I)

 (image/png)    


[image2023-4-20_16-7-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTlhMWFkOWEzMzExZGM3ODM3IiwicmVmX2lkIjoiNjczOTY5YTk3MjgyMDZlZmI5MmVmNWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjM5LCJleHAiOjE3ODIyOTQ2Mzl9.JDqxBANCL-IlgPCMUCHaKRGKakLaAUgkpaqS9I-NSaM)

 (image/png)    


[image2023-4-20_16-7-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTlhMWFkOWEzMzExZGM3ODM4IiwicmVmX2lkIjoiNjczOTY5YTk3MjgyMDZlZmI5MmVmNWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjM5LCJleHAiOjE3ODIyOTQ2Mzl9.Fk9nKOARQ4r-TStbLtpgSSDXcqraTebUr3IOb2nVlqg)

 (image/png)    


[表空间透明压缩测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTk4OTcwYzJhZjRmNTFmOWMyIiwicmVmX2lkIjoiNjczOTY5YTk3MjgyMDZlZmI5MmVmNWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjM5LCJleHAiOjE3ODIyOTQ2Mzl9.L_dhmPI_FKcBSrs10LudzDbc9a2N1HsD0QN53JWn_Zw)

 (application/vnd.xmind.workbook)    


[DBWR_IO_MERGE.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTlhMWFkOWEzMzExZGM3ODM5IiwicmVmX2lkIjoiNjczOTY5YTk3MjgyMDZlZmI5MmVmNWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjM5LCJleHAiOjE3ODIyOTQ2Mzl9.8WmAkpH2NMjynwW4_KjZyfAe0IKEyuE_v8ngvsv4QlU)

 (application/vnd.xmind.workbook)    


[image2023-4-12_17-9-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWE4OTcwYzJhZjRmNTFmOWMzIiwicmVmX2lkIjoiNjczOTY5YTk3MjgyMDZlZmI5MmVmNWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjM5LCJleHAiOjE3ODIyOTQ2Mzl9.Vo-B5ByWCUYnHEWgZ6H_875-Q5L4n2n7e3zytrqhD0A)

 (image/png)    


[支持ROWID数据类型测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWE4OTcwYzJhZjRmNTFmOWM0IiwicmVmX2lkIjoiNjczOTY5YTk3MjgyMDZlZmI5MmVmNWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjM5LCJleHAiOjE3ODIyOTQ2Mzl9.zVroyvj1Ea41_9J6H4ejo10VBYoovA8PIPsCEsVSLmY)

 (application/vnd.xmind.workbook)    


[集群支持非online索引.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWFhMWFkOWEzMzExZGM3ODNhIiwicmVmX2lkIjoiNjczOTY5YTk3MjgyMDZlZmI5MmVmNWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjM5LCJleHAiOjE3ODIyOTQ2Mzl9.FcVMl42gwhpjDDZzLTKZwQtvw-60AR5vbbiJwZbNIL0)

 (application/x-xmind)    


[集群支持非online索引扫描.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWE4OTcwYzJhZjRmNTFmOWM1IiwicmVmX2lkIjoiNjczOTY5YTk3MjgyMDZlZmI5MmVmNWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjM5LCJleHAiOjE3ODIyOTQ2Mzl9.XDUkofgeXvWCxFRYNnCKhP2JcrxitaShr3otjBM7vmA)

 (application/x-xmind)    


[集群支持非online索引.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWFhMWFkOWEzMzExZGM3ODNiIiwicmVmX2lkIjoiNjczOTY5YTk3MjgyMDZlZmI5MmVmNWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjM5LCJleHAiOjE3ODIyOTQ2Mzl9.V-Qcp8VyUCKayj7e2bbRXlMbIQWwNNRr1QL7JHSL7IM)

 (application/x-xmind)    


[集群支持非online索引扫描.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWFhMWFkOWEzMzExZGM3ODNjIiwicmVmX2lkIjoiNjczOTY5YTk3MjgyMDZlZmI5MmVmNWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjM5LCJleHAiOjE3ODIyOTQ2Mzl9.f3VtLn5MeWaPMBE5021FZMOu7AKamELhGPGRKL_79Ro)

 (application/x-xmind)    


[集群支持非online索引.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWE4OTcwYzJhZjRmNTFmOWM4IiwicmVmX2lkIjoiNjczOTY5YTk3MjgyMDZlZmI5MmVmNWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjM5LCJleHAiOjE3ODIyOTQ2Mzl9.YBzxDBXesEUS5KUZWO6knkfw--vDkPP0IQCW9pS1aHE)

 (application/x-xmind)    


[集群支持非online索引扫描.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWFhMWFkOWEzMzExZGM3ODNmIiwicmVmX2lkIjoiNjczOTY5YTk3MjgyMDZlZmI5MmVmNWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjM5LCJleHAiOjE3ODIyOTQ2Mzl9.9Oi8pW2682T8RiBzGifBJ8G6ELADbNuFvjgtDs6Q9f4)

 (application/x-xmind)    


[集群支持非online索引.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWE4OTcwYzJhZjRmNTFmOWNhIiwicmVmX2lkIjoiNjczOTY5YTk3MjgyMDZlZmI5MmVmNWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjM5LCJleHAiOjE3ODIyOTQ2Mzl9.8-tbE5eSg0leplLMZ_YDnCNjDjOswLTen10TrNqyvp8)

 (application/x-xmind)    


[集群支持非online索引扫描.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWE4OTcwYzJhZjRmNTFmOWNiIiwicmVmX2lkIjoiNjczOTY5YTk3MjgyMDZlZmI5MmVmNWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjM5LCJleHAiOjE3ODIyOTQ2Mzl9.pLvf6oZNSBZXNj5Rty9ZZz82Ky3cZp_8XS2gD4_q2FU)

 (application/x-xmind)    


[集群支持非online索引.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWFhMWFkOWEzMzExZGM3ODQxIiwicmVmX2lkIjoiNjczOTY5YTk3MjgyMDZlZmI5MmVmNWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjM5LCJleHAiOjE3ODIyOTQ2Mzl9.OLYUGaeS9eDATd7TwLuQZS4Ph1NYVKm8ImHsM5lq_10)

 (application/x-xmind)    


[集群支持非online索引扫描.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWFhMWFkOWEzMzExZGM3ODQyIiwicmVmX2lkIjoiNjczOTY5YTk3MjgyMDZlZmI5MmVmNWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjM5LCJleHAiOjE3ODIyOTQ2Mzl9.jvNBp6iRggk7XYI_bRRAZLd6kJ-Sc2GOgePrCaZnwlw)

 (application/x-xmind)    
