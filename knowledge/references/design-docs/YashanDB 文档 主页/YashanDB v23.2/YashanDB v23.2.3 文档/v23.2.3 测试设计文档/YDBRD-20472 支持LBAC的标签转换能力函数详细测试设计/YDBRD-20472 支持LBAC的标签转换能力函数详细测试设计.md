Created by 周彬鑫, last modified on 六月 04, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/661165e6579a3edb84d6e34d](https://pingcode.yasdb.com/pjm/items/661165e6579a3edb84d6e34d)    ?    
  #YDBRD-20472 支持LBAC的标签转换能力函数

LBAC策略里   label_to_char、char_to_label、lbacsys.lbac$sa_labels.from_label函数的使用

# 2. 需求分析

## 2.1 功能点分析

- *label_to_char 函数：*  函数将标签值转换为字符串内容，返回类型为 VARCHAR2。
- char_to_label 函数：  函数将字符串内容转换为标签值，返回类型为 NUMBER。
- lbacsys.lbac$sa_labels.from_label 函数：  根据给定策略和level,compartment, group的值组成的字符串，返回对应的level,compartment, group的名字组成的字符串，


## 2.2 应用场景

- LABEL_TO_CHAR 根据给定的标签值返回标签内容。
- CHAR_TO_LABEL 跟据给定的标签内容字符串返回标签值。
- LBAC$SA_LABELS.FROM_LABEL将 策略id及级别、范围、组的值组成的字符串内容转化为标签字符串内容。
- ilabel格式组成：
- ![](https://conf.yasdb.com/download/attachments/153006566/image2024-5-13_15-43-34.png?version=1&modificationDate=1715671143000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ4ODMsImV4cCI6MTc4MjMxNTY4M30.KTjGVsJgiaiqXY2nhO-UZYdxJjnYn4VoRp1ynpJFWb0)


|  `FUNCTION LABEL_TO_CHAR (`      
    
    `    `      `label IN BIGINT)`      
    
    `RETURN VARCHAR;`  |
|:---|


|  `FUNCTION CHAR_TO_LABEL (`      
    ` `      
    `    `      `policy_name IN VARCHAR,`      
    ` `      
    `    `      `label_string IN VARCHAR)`      
    ` `      
    `RETURN BIGINT;`  |
|:---|


|  `FUNCTION FROM_LABEL(`      
    `  `      
    `    `      `ilabel  IN VARCHAR)`      
    `  `      
    `RETURN VARCHAR;`  |
|:---|


## 2.3 规格约束

- *无*


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值； 函数使用场景：场景组合法*

  


## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*


**1.1 label_to_char**

|测试点|等价类|备注|
|---|---|---|
|标签值|标签值存在，返回标签内容字符串|  
|
||标签值不存在， 报错invalid label string|  
|
||标签值类型|  
|
||更改/删除标签后执行|  
|
|参数|参数为表达式（运算表达式、布尔表达式、连接符||、位运算|  
|
||参数为伪列、科学计数法|  
|
||参数个数0个 1、2个|  
|
||入参数据类型|  
|
||返回类型|  
|
|权限|有/无标签权限的用户进行操作|是否有必要？|
||用户标签等级低于目标标签|  
|
|DQL|投影列、filter、子查询|  
|
|DML|insert/delete/update filter 中|  
|


**1.2 char_to_label**

|一级分类|二级分类|等价类|备注|
|---|---|---|---|
|参数    
    
    
    
    
    
|policy_name  参数|策略名存在/不存在|不存在时报错  policy p11 not found。,（与表无关）|
|||参数大小写不敏感|  
|
||label_string参数    
    
    
|标签名存在/不存在|  
|
|||标签名不合法|报 invalid label string:xxx。|
|||标签内 范围的组成内容成员的重复、次序不一致|标签值获取正确|
|||参数大小写不敏感|  
|
||参数个数|0个 1个 3个|报错|
|使用场景|DQL|投影列、filter、子查询|在select 查询中，若标签内容字符串不存在，则会新创建个label，label_tag自动生成（取自序列YLS$LAB_SEQUENCE.nextval），LABEL_TYPE 对应 USER LABEL   |
||DML|insert 语句中|（1）若标签内容字符串不存在则报错；,（2）若标签内容字符串存在但是类型不为 USER/DATA LABEL， 则报错：ORA-12406: 未经策略 P1 授权的 SQL 语句。,（3）若插入的值根据用户上挂载的标签信息，经计算若不是可写（）的数据则报错。ORA-12406: 未经策略 P1 授权的 SQL 语句。|
|||delete、update语句使用|  
|
|||LBAC 更新数据行的标签使用char_to_label|  
|
|||执行函数时生成label的场景， 检查系统表，验证自治事务|  
|
|权限    
    
    
||有/无标签权限的用户进行操作|是否有必要？|
|||用户标签等级低于目标标签|  
|


**1.3 lbacsys.lbac$sa_labels.from_label**

|测试点|等价类|备注|
|---|---|---|
|参数|ilabel参数边界：参数长度 =4k 、<4k、 >4k|  
|
|  
|参数个数为0个/2个|  
|
|  
|参数含连续多个%|  
|
|  
|省略部分/全部 间隔符 ‘.‘|报错|
|  
|policyId 数值不够补'0'|  
|
|  
|覆盖所有组合标识 10、11、12、13|  
|
|  
|plicyId 有效/无效、组合标识有效/无效、level有效/无效、compValue有效/无效|无效取值时报错（组合标识为无效值时不报错，与oracle一致，其余报错）|
|  
|参数带groupValue|目前不支持create group, 报错|
|DQL|投影列、filter、子查询|  
|
|DML|insert/delete/update filter 中|  
|
|其他场景|结合SET_USER_LABELS 使用|  
|
|  
|非sys用户带/不带 'sys.'执行|非sys用户不带 'sys.'执行报错,  
|
|  
|sys用户带/不带 'sys.' 执行|  
|
|  
|结合dba_sa_labels/yls$user_label/yls$label系统表的ilabel对比|  
|
|权限|非sys用户需要PACKAGE执行权限才能访问from_labels函数|  
|


**1.4 混合使用函数**

|测试点|等价类|备注|
|---|---|---|
|嵌套使用函数|label_to_char、char_to_label、lbacsys.lbac$sa_labels.from_label混合嵌套使用|  
|
|  
|嵌套其他内置函数|简单覆盖：,字符函数(concat/substr...)|
|大量数据|写入大量数据，系统表膨胀？|  
|


**1.5 测试范围：单机**

1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|---|---|
|CT|是（删除、新建、查询并发）|
|KT|是|
|长稳|与LBAC标签SR一起|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|---|---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  [详细测试设计文档模板.doc](#)  

## Comments:

|  [](null)  ,会议名称：LABC标签转换函数测试设计评审,评审,评审时间：2024/05/21 10:00-11:00,参与人：刘晓旋、王海峰、廖峰、王林、周彬鑫,1.补充测试char_to_label创建label时是否是自治事务，系统表是否正常更新,2.补充删除标签、新建标签、使用函数并发测试,评审结论：通过,Posted by zhoubinxin at 五月 21, 2024 10:57|
|---|
