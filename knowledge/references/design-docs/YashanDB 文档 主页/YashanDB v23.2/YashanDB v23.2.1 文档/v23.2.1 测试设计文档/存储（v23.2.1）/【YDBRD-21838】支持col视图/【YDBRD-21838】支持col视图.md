Created by 刘丹, last modified on 十一月 07, 2023

# **1. 概述**

col视图兼容oracle，类似于视图DBA_TAB_COLUMNS、USER_TAB_COLUMNS、ALL_TAB_COLUMNS，会显示表的列信息

# **2. 需求分析**

### 2.1 SR: 支持col视图

链接：    [[YDBRD-21838] 支持col视图 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21838)  

开发设计：    [col视图设计文档 - 王博文 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133573880)  

场景：兼容oracle视图

功能：

      1.根据表名，提供col视图查询，明确表中的各字段

功能限制：

     无

### 2.2语法

**desc col;**

**select * from col ;**

**【col视图字段】：共9个字段**

|字段|类型|null|说明TNAME|
|:---|:---|:---|:---|
|TNAME|VARCHAR2(128)|NOT   NULL|列所属的表或视图的名称。|
|COLNO|NUMBER|NOT   NULL|列在表或视图中的编号，从1开始计数。|
|CNAME|VARCHAR2(128)|NOT   NULL|列的名称。|
|COLTYPE|VARCHAR2(265)|  
|列的数据类型。该列包含完整的数据类型说明，包括长度、精度和比例。|
|WIDTH|NUMBER|NOT   NULL|列中存储的值的最大长度|
|SCALE|NUMBER|  
|当前列包含的数字值的比例（小数点右侧的位数）|
|PRECISION|NUMBER|  
|当前列包含的数字值的精确度（总位数）。|
|NULLS|VARCHAR2(19)|  
|该列是否允许包含空值。如果该列允许包含空值，则为    `YES`    ；否则为    `NO`  |
|DEFAULTVAL|LOGN|  
|列的默认值。如果该列没有设置默认值，则该字段为空。|


  


**3. 测试**  **设计方法**   

### 3.1 特性关联领域分析：

1.部署形态：单机部署和一主两备主备部署

2.对col视图进行desc结构查询

3.建表或者视图在col视图中查询表或者视图的结构

4.HA：主机创建表或者视图，备机根据TNAME字段查询

### **3.2 **  梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|  
|
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
|HA|是|
|压力|  
|
|性能|  
|
|可维护性|  
|
|资料|是|


### 3.3测试设计：

语法验证部分采用等价类划分，功能部分采用场景法

# 4.   **详细测试设计**   

### 4.1：col视图语法验证

|输入条件|有效等价类|无效等价类|备注|
|---|---|---|---|
|  
|select * from sys.col|sys.co|覆盖查询全部字段和部分字段|
|  
|select * from col|select *  from coll |  
|
|  
|desc col|  
|  
|
|  
|desc sys.col|  
|  
|


### 4.2：功能测试

|序号|测试场景|用例详细描述|预期|备注|
|---|---|---|---|---|
|1|创建一个表或者视图对其字段进行查询|直接对视图进行查询确认各字段是否符合预期|成功|覆盖基本数据类型，|
|2|  
|drop基表的一个列进行查询，视图会少一行|成功|  
|
|3|  
|add基表的一个列，视图会增加一行|成功|  
|
|4|  
|rename列名，CNAME字段改变|成功|  
|
|5|  
|modify某个列的数据类型，对应的字段改变|成功|  
|
|8|  
|rename表名，TNAME字段改变|成功|  
|
|  
|  
|join查询，跟其它表或者视图联合查询（where等条件）|  
|  
|
|  
|临时表|创建临时表，并在col视图中查询|  
|  
|
|  
|创建嵌套表|创建嵌套表，并在col视图中查询|  
|  
|
|9|切换用户|创建A和B2个用户，A用户下创建的表，B用户通过col视图查询|报错|  
|
|10|同名对像|创建table_name是col的表|成功    
    
|  
|
|11|  
|创建view_name是col的视图,  
|成功    
    
|  
|
|12|主备环境|主机创建表和视图对象，备机查询|成功|  
|
|13|拦截测试|共享集群（desc col,select * from col）--天然支持|支持|22.2|
|  
|  
|分布式（desc col,select * from col）--天然支持，对比|支持|没必要考虑|


# 5.   **测试用例**

# 6.   **测试框架设计**

采用guider框架，编写sql脚本执行

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


## Attachments:

[整库拷贝后的路径转换.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWVhMWFkOWEzMzExZGM4NjdiIiwicmVmX2lkIjoiNjczOTZiZWQ3MjgyMDZlZmI5MmYwYmM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MDEzLCJleHAiOjE3ODIzODQ0MTN9.t08gOvjnZ_UFVe4Kv7swna8O3Yk1TcpDYtCQtvnTOqc)

 (application/x-xmind)    


[content_1686877662939.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWU4OTcwYzJhZjRmNTIwODA2IiwicmVmX2lkIjoiNjczOTZiZWQ3MjgyMDZlZmI5MmYwYmM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MDEzLCJleHAiOjE3ODIzODQ0MTN9.2ZWVb50AJfkRzegJQ205Iw6MYGbnvVIhO9sqMw6BAfM)

 (application/x-xmind)    


[支持col视图.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWVhMWFkOWEzMzExZGM4NjdjIiwicmVmX2lkIjoiNjczOTZiZWQ3MjgyMDZlZmI5MmYwYmM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MDEzLCJleHAiOjE3ODIzODQ0MTN9.Kz72is61_63DqpLQUV6u-4Wu3vJfeqicaROURN_EbXM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[支持col视图.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWU4OTcwYzJhZjRmNTIwODBhIiwicmVmX2lkIjoiNjczOTZiZWQ3MjgyMDZlZmI5MmYwYmM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MDEzLCJleHAiOjE3ODIzODQ0MTN9.jjDZBN3lGAKa20UcHUCb_JtcFIbZxWicOhs_tPSTKzE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
