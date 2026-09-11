Created by 党文琪, last modified on 十月 12, 2024

# 1.   **概述**

表列类型定义支持varchar(32000 [char|byte])测试设计

SR链接：    [YDBRD-15300](https://jira.yasdb.com/browse/YDBRD-15300?src=confmacro)    -  VARCHAR支持单列存储规格提升为32000  完成

# 2.   **需求分析**

**对功能/需求进行详细说明及分析，包括但不限于需求涉及的规格、约束，主要业务场景，系统/模块上下文等**

本需求重点关注varchar(32000 [char|byte])，即超长字符串列，在行存单机上支持后，与字符集，sql语句，升级及函数的适配。

**超长字符串列**  ：使用lob存储的字符串类型。对varchar(n) ，单位是字节，当n超过8000时，就是超长字符串；varchar(n char) 单位是字符，n * MaxCharWidth > 8000时，认为是超长字符串类型（其中MaxCharWidth是字符集最大字节长度，UTF8下是4，GBK下是2，ISO8859-1和ASCII下是1）。

有约束如下：

1、超长字符串列和普通字符串列不管表数据是否为空都不可以互相modify。超长字符串列只能在超长字符串列的范围内modify，普通字符串列只能在普通字符串列范围内modify

2、超长字符串列  不支持建索引、不能作为主键、不能有唯一约束、不能作为分区键、不能建外键

3、PTT不能建超长字符串列

# **3. 测试设计方法**

**主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计;重点关注超长字符串做表列时DDL,DML,升级，设计修改的函数及视图。**

# **4. 详细测试设计**

**1）测试场景**

本次测试需要覆盖单机行存

**2）公共测试点**

1、构造数据覆盖边界值及中英文，数字等多种字符类型

2、关注系统表col$字段，及dba_lobs视图中的记录

3、覆盖不同的字符集，UTF8字符集可自动化，其他字符集整理差异点单独手动覆盖

**3）SQL语句**

|  
|测试点|备注|
|---|---|---|
|DDL|create table|  
|
|  
|create table as select|  
|
|  
|modify column|新增或删除表列,修改表列类型或长度,修改列名,修改缺省值|
|  
|truncate|  
|
|  
|drop/drop if exists|  
|
|DML|insert|insert into values（）,INSERT INTO parts2 (pnum, pname)    
  VALUES (pnums(i), pnames(i));,insert into select,有指定默认值时的insert,insert into on duplicate key update|
|  
|update|  
|
|  
|delete|  
|
|  
|merge into|  
|
|  
|select|select into,select 函数,select 拼接|
|异常场景|更新的表列长度超出指定范围,将长字符串转换为短字符串是否有异常或截断    
  cast（c1 as varchar(200)）|  
|


**4）相关函数**

参考开发设计文档中函数列表覆盖

  [YDBRD-15300：表列类型定义支持varchar(32000 [char|byte]) - 钟金健 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=113975122)  

**5）PLSQL**

结合游标及select into取表列，赋值给过程体内其他变量

**6）跨分区更新**

旧用例中的clob类型改为varchar，验证结果正确性

**7）导入导出**

导入导出无截断，数据能够正常恢复

**8）性能**

1、多表列，超过63k时的性能

2、对比普通表列和超长表列插入相同数据量时的性能

**9）并发**

**10）升级**

varchar(2001 char - 8000 char)升级后的兼容性，主要检查：

1、系统表

2、新增的varchar(2001 char - 8000 char)约束是否生效，原有的配置如何处理

3、存量数据与新建数据的拼接，运算结果

关注varchar(2001 char - 8000 char)类型在升级前后的变化

详细测设设计见如下附件

# 5.   **测试用例**

**文本用例：**

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


# 6.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Attachments:

[varchar(32000).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWM4OTcwYzJhZjRmNTFmOTc4IiwicmVmX2lkIjoiNjczOTY5OWM1OTNmOTljOWZmMjM1MDhmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzE0LCJleHAiOjE3ODIyOTQxMTR9.EDXfX_cno55zglcS2NmoHCTM2hKnOPvo1fOrriRSTSs)

 (application/x-xmind)    


[varchar(32000).xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWNhMWFkOWEzMzExZGM3N2VlIiwicmVmX2lkIjoiNjczOTY5OWM1OTNmOTljOWZmMjM1MDhmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzE0LCJleHAiOjE3ODIyOTQxMTR9.QdGOsNIYgHSqYnHaYcTB4zKV_n422FSyb3SURILs-kU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
