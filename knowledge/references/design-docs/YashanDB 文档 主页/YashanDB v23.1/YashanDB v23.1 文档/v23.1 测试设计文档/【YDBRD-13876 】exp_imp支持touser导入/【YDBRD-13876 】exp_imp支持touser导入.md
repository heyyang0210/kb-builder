Created by 刘晓芳 on 十一月 14, 2023

# **1. 概述**

本文描述exp/imp支持touser导入功能的测试设计；

开发设计文档：    [YDBRD-14204【imp/exp】支持schema变更，实现to user能力](107391854.html)  

SR：    [YDBRD-13876](https://jira.yasdb.com/browse/YDBRD-13876?src=confmacro)    -  【imp/exp】支持schema变更，实现to user能力  完成

            [YDBRD-14204](https://jira.yasdb.com/browse/YDBRD-14204?src=confmacro)    -  【imp/exp】支持schema变更，实现to user能力  完成

# **2. 需求分析**

## 2.1语法

imp导入语法新增touser参数

## 2.2 功能描述

（1）touser导入过程换对象的用户。将原始对象的owner换成touser指定的用户。默认值：NONE；

（2）touser必须配合fromuser一起使用，单独使用touser会报错，无法导入

（3）touser的功能只在imp导入时才能使用

（4）用户下对象包括：Sequences，Synonyms，Tables，Indexes，Constraints（check,unique,PrimaryKeys,ForeignKeys）,对象：'VIEW', 'TRIGGER', 'PROCEDURE', 'PACKAGE', 'PACKAGE BODY', 'UDF', 'JOB'

（5）fromuser/touser个数限制：33824（list的限制）。

（6）fromuser/touser长度限制: 以67截断，不报错。

（7）所有arg的总长不能超 16KB

## 2.3 规格限制

满足客户现场场景，部分约束：

（1）fromuser和touser的数量必须一致；可指定多个，fromuser会去重，touser不去重。去重后fromuser的数量和touser必须一致。

（2）touser要求  登录用户必须有dba权限

（3）权限级联说明：  toUser开启后，仅导入grantor是tableOwner的权限。

（4）touser必须与formuser配合，单独touser，报错。统计项如下：

|语法|现象|约束|
|:---|:---|:---|
|imp user1/1 full=y touser=user2 file=a|报错|报错|
|imp sys/Cod-2022  touser=user2 file=a|touser 必须配合使用fromuser|报错|
|imp sys/Cod-2022  fromuser=user3 touser=user2 file=a|user模式，指定fromuser=user3，则将user3 的数据导入到user2，|成功，登录用户user1必须有dba权限|
|imp sys/Cod-2022 fromuser=user3,user4 touser=user2 file=a|报错|报错，fromuser和touser的数量必须一致|
|imp sys/Cod-2022  fromuser=user3 touser=user2,user4  file=a|报错|报错，fromuser和touser的数量必须一致|
|**imp sys/Cod-2022  fromuser=user3,user3 touser=user2,user4  file=a**|**fromuser重复，只算一次，fromuser是1个，touser是2个，报错**|**报错，fromuser和touser的数量必须一致**|
|**imp sys/Cod-2022  fromuser=user3,user3 touser=user2 file=a**|成功|成功|
|imp sys/Cod-2022  fromuser=user4,user5 touser=user2,user2  file=a|touser重复，但是数量和fromuser一致  user4->user2，user5 -》user2，如果user4和user5有重名对象，则warning：对象已存在|成功|
|imp sys/Cod-2022  fromuser=user4 touser=notExist file=a|touser的用户notExist不存在，则报错：YAS-02010 user 'a' does not exist|报错|
|imp sys/Cod-2022  fromuser=user1,user2 touser=user3,user4  file=a|user1->user3，user2 -》user4|成功|
|imp sys/Cod-2022  touser=user2,user3 tables=t1 file=a|touser 必须配合使用fromuser|报错，touser 必须配合使用fromuser|
|imp sys/Cod-2022  fromuser=user1,user4 touser=user2,user3 tables=t1 file=a|成功|成功|
|imp sys/Cod-2022  fromuser=user1 touser=user2,user3 tables=t1 file=a|报错|报错，fromuser和touser的数量必须一致|
|imp sys/Cod-2022  fromuser=user3 touser=user2 file=a ingore=y|touser指定的用户不存在时，直接报错终止导入|与Oracle有差异：忽略接着导入|


## **3. 测试设计方法**   

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计，导入导出数据背景部署所有隶属用户的对象（权限单独校验）；

测试场景：

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|touser检验|关键字校验|- touser覆盖大小写
- 指定的用户名称为touser，table参数值同名
- 带双引号  （区分大小写）
|不报错，正常导入，数据都在指定用户下|- 单引号
- 拼写错误，缺失，带下划线等
|报错提示正确，终止导入|
|  
|指定值校验|- 最长字符串：16K
- 用户名带双引号，包含特殊字符
- 用户指定上限个数：1024
- 不指定用户：不指定touser参数
|**备注：不指定tosuer，指定fromusr的时候，会把fromuser的数据导入到登录用户中**|- 用户名不带双引号，包含特殊字符
- 用户名之间用分号等其他符号隔开/，_,@
- 用户名之间带多个逗号
- touser为空，null，’‘，’“”，’ ‘，“  ”等
|报错提示正确，终止导入|
|  
|位置校验|- touser在imp的所有参数第一个/最后一个
- touser在fromuser之前，之后
|不报错，正常导入，数据都在指定用户下|  
|  
|
|导入对象覆盖（  刘晓芳/李凯峰  ）|/|覆盖,- Sequences  —   李凯峰
- Synonyms  --  李凯峰
- tables --  李凯峰
- indexes   — 有存量用例：  李凯峰
- constrains--   李凯峰
- view  –   李凯峰
- trigger  —有存量用例
- procedure  — 有存量用例
- package  —有存量用例
- udf  — 有存量用例
- job  — 有存量用例
,测试原则：,- 单个场景：每个对象根据语法图覆盖全（在单个sql里面可以有多个不同的对象类型）
- 混合场景：需要1个用例导出导入所有单个场景的sql用例
|结合导入模式测试|**先把对象创建的sql写完，然后合并所有SQL作为前置条件去导入导出**|  
|
|结合fromuser使用|/|此测试点需要结合导入对象一起测试：,- fromuser=A，touser=B；
- fromuser=A，touser=A;
- fromuser=A1，B1，touser=A2、B2
- fromuser=A，B，touser=B,A
- fromuser=A，B1,C1,A,B1,C1，touser=B2,C2,D2
- fromuser,touser指定16个用户
- fromuser指定1024个重复用户A，touser=B
- fromuser,touser指定1024个用户
- fromuser用户下对象为空，touser导入
|导入成功后，查询touser指定的用户下业务正确，  原来的user下无数据？？？|- 没指定fromuser，单独指定touser
- fromuser=A，touser=B,C
- fromuser=A，touser=A,B
- fromuser=A，touser=B，B，B，B
- fromuser=A,B,touser=A
|报错，提示信息一理解，无误差|
|结合table测试（  李凯峰  ）|/|覆盖：,- A用户下只有table1,fromuser=A,touser=B,table=table1
- A用户下有多个table，fromuser=A,touser=B，table指定其中1个
- 16个用户下各自有多个table，fromuser指定16个用户,touser指定16个新用户，table指定其中多个table
|  
|- A用户下有多个table，fromuser=A,touser=B，table指定不存在的table
|报错，终止导入|
|全库导入导出（  李凯峰  ）|  
|覆盖：,- exp全库导出，导入指定fromuser=A,touser=B
- exp全库导出，导入指定fromuser=A1,B1,touser=A2、B2，各自指定16个用户，部分用户下面无业务
|  
|  
|  
|
|结合ingore测试|/|覆盖：,- 指定touser导入时，指定用户下已经存在部分重复的对象，ingore=y
- 指定touser导入时，指定用户下已经存在部分重复的对象，ingore=n
|- 重复对象不导入，其他对象继续导入
- ingore=n时，报错，不导入
|- fromuser用户不存在，touser用户存在，ingore=y
- fromuser用户存在，touser用户存不在，ingore=y
|报错，导入终止|
|权限测试（  李凯峰  ）|对象级权限|表级权限：,- 普通A用户表table1，表select/inset/update权限A赋予B，B赋予C，C赋予D，全库导出，指定导入到B用户
- 普通A用户表table1，表select/inset/update权限A赋予B，B赋予C，C赋予D，全库导出，指定导入到C用户
- 普通A用户表table1，表select/inset/update权限A赋予B，B赋予C，C赋予D，全库导出，指定导入到D用户
- 普通A用户表table1，表select/inset/update权限赋予B，C，D，指定B导入
|- touser导入后，查看表级权限关系，所有用户没有权限
- touser导入后，查看表级权限关系，只被赋予了B
- touser导入后，查看表级权限关系，只被赋予了B
- touser导入后，查看表级权限关系，B赋予权限
|1、导入之前，手动重建A、B、C、用户，保证用户存在。,  
|  
|
|  
|系统级权限|/|/|- 指定系统权限：表、索引、序列、同义词、视图、存储过程、触发器、自定义库
- 步骤1中，全库导出，指定touser导入
|系统权限不导入|
|规格|  
|- 混合对象场景，不同的对象达1000个以上，导出后，touser导入
|正常导入|  
|  
|
|登录用户|/|- 登录用户有dba权限，不能与fromuser，touser同用户
,更正：,- **登录用户有dba权限，与fromuser用户同名**
- **登录用户有dba权限，与touser用户同名**
- **登录用户有dba权限，与fromuser，touser用户同名**
|正常导入|- 登录用户没有dba权限
- 登录用户与formuser，touser同名
|报错，不导入|
|部署环境|  
|覆盖：,- **单机---高优先级**
- 分布式（覆盖分区键、分布键、分布类型）--主要是table对象的差异（低优先级）
|  
|  
|  
|


  


# **4. 详细设计**

#   
  5.   **测试用例**

#   
  6.   **测试框架设计**

本次测试采用regress测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|  
|
