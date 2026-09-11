Created by 党文琪, last modified on 十月 12, 2024

# 1.   **概述**

此测试设计列表列类型定义支持varchar(32000)测试设计

SR链接：    [YDBRD-15900](https://jira.yasdb.com/browse/YDBRD-15900?src=confmacro)    -  VARCHAR支持列表的单列存储规格提升为32000  完成

# 2.   **需求分析**

**对功能/需求进行详细说明及分析，包括但不限于需求涉及的规格、约束，主要业务场景，系统/模块上下文等**

本需求重点关注varchar(32000)，即超长字符串列，在单机，分布式列存与sql语句，存储等的适配。

**与行存不同，列存的超长字符串在超过8000后不会转成lob类型存储，故modify不受限制**  。

有约束如下：

1、  超长字符串列  不支持建索引、不能作为主键、不能有唯一约束、不能作为分区键、不能建外键

2、  PTT  不能建超长字符串列

# **3. 测试设计方法**

**主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计;重点关注超长字符串做表列时DDL,DML,升级，设计修改的函数及视图。**

# **4. 详细测试设计**

**1）测试场景**

本次测试需要覆盖单机列表及分布式

**2）公共测试点**

1、构造数据覆盖边界值及中英文，数字等多种字符类型

2、关注系统表col$字段，及dba_lobs视图中的记录

3、覆盖不同的字符集，UTF8字符集可自动化，其他字符集整理差异点单独手动覆盖

**3）SQL语句**

|  
|测试点|备注|
|:---|:---|:---|
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

参考开发设计文档中函数列表覆盖，重点关注列表走行执行的函数是否受影响

  [YDBRD-17069：列表列类型定义支持varchar(32000) - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=122075752)  

**5）PLSQL**

结合游标及select into取表列，赋值给过程体内其他变量

**6）导入导出**

导入导出无截断，数据能够正常恢复

**7）性能**

1、多表列，超过63k时的性能

2、对比普通表列和超长表列插入相同数据量时的性能

**8）统计信息**

**有超长字符串做表列时，收集统计信息是否有受影响**

**9）逻辑复制**

**开启表附加日志，dml后检查生效情况**

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

[列表支持varchar32k.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWU4OTcwYzJhZjRmNTFmOTgyIiwicmVmX2lkIjoiNjczOTY5OWU1OTNmOTljOWZmMjM1MGEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzM1LCJleHAiOjE3ODIyOTQxMzV9.y5q21AsWEfJ_B6AjJXvv-gD4eAY77rgl41gHeVqS8B0)

 (application/x-xmind)    


[varchar32k.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWU4OTcwYzJhZjRmNTFmOTgzIiwicmVmX2lkIjoiNjczOTY5OWU1OTNmOTljOWZmMjM1MGEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzM1LCJleHAiOjE3ODIyOTQxMzV9.TW5ijGzBOk-AGelrRqleAWzU0PtvjLcg9slJw3rGVPs)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
