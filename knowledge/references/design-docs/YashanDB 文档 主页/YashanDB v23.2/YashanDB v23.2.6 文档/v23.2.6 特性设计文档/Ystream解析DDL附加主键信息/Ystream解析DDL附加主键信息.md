Created by 马志宏, last modified on 十月 08, 2024

  [https://pingcode.yasdb.com/pjm/items/67048997e489dd0868f15411](https://pingcode.yasdb.com/pjm/items/67048997e489dd0868f15411)    ?    
  #YDBRD-33388 Ystream解析DDL附加主键信息

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

目前DDL的附加日志里只包含object id和sql语句，不包含更详细的元素描述，比如主键信息等。如果要获取DDL的详细元素信息，就必须解析SQL语句，代价较高，并且某些场景信息页无法获得，比如默认的主键约束名称。

如果在DDL附加日志里添加主键相关的信息，则可以简单快速获得这条DDL的主键信息。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

1. YDS能同步主键的更新需求。


部署形态：  **单机**

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

无 

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|DDL带主键变更|将主键信息组装成json字符串，写入redo日志，有YStream解析成字符串|是|是|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|附加日志|在redo里添加objectId，xid等额外信息，以便可以从redo里解析出DML|是|  [https://en.wikipedia.org/wiki/Change_data_capture](https://en.wikipedia.org/wiki/Change_data_capture)  |


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

不涉及

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

|  
|**接口**|**简介**|**详细**|
|:---:|:---:|:---:|:---:|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**规格：**

1. 支持CREATE TABLE，ALTER TABLE针对主键的add，drop，enable操作的记录
1. add 主键时会记录主键约束名


**约束：**

1. drop column的同时删除主键不会记录主键drop信息


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

主键json格式：

{

  name=主键约束名,   // drop主键的DDL如果不带约束名时，该值为空字符串

  action=ADD|DROP|ENABLE|DISABLE,

  disable=false,

  columnNames=[主键列名数组],  // add主键时，不为空

  keepIndex=null,

  dropIndex=null

}

### 4.1 建表带主键的DDL

- CREATE TABLE test(a int PRIMARY KEY, b int);
- CREATE TABLE test(a int, b int, PRIMARY KEY(a));
- CREATE TABLE test(a int, b int, CONSTRAINT my_pk PRIMARY KEY(a));


### 4.2 建表后添加主键

- ALTER TABLE test ADD PRIMARY KEY(a);
- ALTER TABLE test3400 ADD CONSTRAINT my_pk PRIMARY KEY(a);
- ALTER TABLE test MODIFY (a int primary key); -- modify可以给已有的列加pk
- ALTER TABLE test add column c int primary key; -- 增加列可以指定pk


### 4.3 删除主键

- ALTER TABLE test DROP primary key;
- ALTER TABLE test3400 DROP CONSTRAINT my_pk; -- 这个约束是pk


### 4.4 modify，enable主键

- ALTER TABLE area DISABLE PRIMARY KEY;
- ALTER TABLE test MODIFY PRIMARY KEY ENABLE;


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

|序号|用例内容|预期结果|实际结果|
|:---|:---|:---|:---|
|1|CREATE TABLE test(a int, b int, PRIMARY KEY(a));|add主键，主键列为A|  
|
|  
|ALTER TABLE test DROP primary key;|drop主键|  
|
|  
|ALTER TABLE test add column c int primary key;|add主键，主键列为C|  
|


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

1. 不涉及


  


##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2024-6-14_20-57-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDY4OTcwYzJhZjRmNTIxNjVlIiwicmVmX2lkIjoiNjczOTZlMDY3MjgyMDZlZmI5MmYyNTMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjYzLCJleHAiOjE3ODI0MDAwNjN9.3KtSnj9F9j6-ThWGvZIW7qvKVJYzwiRSfL0xvWuW0nY)

 (image/png)    
