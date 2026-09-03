Created by 陈瑞, last modified by  刘大境 on 五月 11, 2024

# 1. 概述

***SR***  *：*    [https://pingcode.yasdb.com/pjm/items/6625d483fd997db58ade78ce](https://pingcode.yasdb.com/pjm/items/6625d483fd997db58ade78ce)    *?*  *#YDBRD-26551 TDE和备份加密支持国密算法*

*开发设计：*    [TDE和备份加密支持国密算法设计方案 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150631580)  

**背景**  ：master版本现状：不支持  加密  表空间指定算法，默认算法AES128(非国密)。现需要通过商密认证。

**需求描述**  ：新增满足国密的算法SM4。1、加密表空间创建时可以指定加密算法，不指定时默认sm4。2、对于备份，已经支持创建时可以指定包括sm4在内的加密算法，仅修改不指定加密默认算法  AES128  改为SM4

**需求范围**  ： 单机和集群

表类型：LSC、HEAP

  


# 2. 需求分析

## 2.1 功能点分析

- 支持创建透明加密表空间语法+功能支持 (备份指定算法语法已支持)
- 创建透明加密表空间不指定加密算法，默认加密算法
- 创建透明加密表空间指定旧加密算法，语法支持，旧功能不受影响。对于旧功能看护，由于默认加密方式改为sm4，库上需要新增用例看护。
- 备份不指定时，加密算法默认  AES128  改为SM4


## 2.2 应用场景

1、使用TDE指定算法，  表和依赖表空间存储的  对象的功能(加密，解密)使用正常

2、升级场景：

    旧版本加密算法表空间，数据库升级后兼容。升级路径 22.2 → 23.2最新，23.2 归档包 -> 23.2最新

3、两种算法的表空间混合使用，在数据落盘，清理缓存区后做查询

    a.有依赖关系的对象。表和索引，表和AC。表/索引/AC的不同加密算法的表空间上。查询索引/ac数据并回表，同时使用到索引和表的数据。

    b.没有依赖关系的对象。表1和表2在不同加密算法的表空间上,一条查询语句包含两表，查询。

    c.同一对象同时使用两种加密算法的表空间。表/索引分区在不同加密算法的表空间上,查询。

## 2.3 规格约束

如果配置国密算法，则必须使用SM4。

# 3. 详细测试设计

## 3.1 测试设计方法

1、语法功能较简单，覆盖指定算法（AES128和SM4）

2、功能使用场景法，观察点有两个：是否加密，是否解密。执行alter system checkpoint使数据落盘(加密过程)，通过string 数据文件，不能查到明文数据；执行alter system flush buffer_cache触发buffer淘汰后做查询（解密过程），查询数据正常不报错。

     上车后，存量加密表空间用例自动覆盖sm4算法

     但是对于AES128算法的功能也需要看护，需要复制一份旧用例(不用全量，只挑选功能用例)，修改建表空间为显式指定为AES128。

存量用例路径：单机standalone/testcase/storage_object/tablespace/tablespace_encrypt    集群：散落在不同目录

3、对两种加密算法混合使用场景,分析主要有以下

    a.有依赖关系的对象。表和索引，表和AC。表/索引/AC的分区在不同加密算法的表空间上。查询索引/ac数据并回表，同时使用到索引和表的数据。

    b.没有依赖关系的对象。表1和表2在不同加密算法的表空间上,一条查询语句包含两表。

    c.同一对象同时使用两种加密算法的表空间。表/索引分区在不同加密算法的表空间上。

3、升级后兼容旧算法

## 3.2 详细测试设计

|系统级DFX分类|是否涉及|备注|
|---|---|---|
|CT|涉及|已有旧用例覆盖|
|KT|涉及|已有旧用例覆盖|
|长稳|涉及|已有旧用例覆盖|
|一致性|不涉及|没有改动一致性读逻辑|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|不涉及|
|安全|涉及|功能用例string 查看加密后文件是否有明文，已经验证到|
|DFR|不涉及|不涉及|
|HA|涉及|  
|
|压力|不涉及|转测功能不涉及该模块修改|
|性能|涉及|旧用例已覆盖|
|可维护性|不涉及|转测功能不涉及该模块修改|


语法(冒烟用例)：

|场景|  
|语句|预期|备注|
|---|---|---|---|---|
|指定SM4|  
|CREATE TABLESPACE xxx  ENCRYPTION USING 'SM4' ENCRYPT|创建成功|冒烟|
|指定AES128|  
|CREATE TABLESPACE xxx  ENCRYPTION USING 'AES256' ENCRYPT|创建成功|冒烟|
|不指定|  
|CREATE TABLESPACE xxx  ENCRYPTION ENCRYPT|创建成功|冒烟|
|无效类|using 关键字缺失|CREATE TABLESPACE xxx  ENCRYPTION|失败|  
|
|  
|算法名缺失|CREATE TABLESPACE xxx  ENCRYPTION USING 'AES256'|失败|  
|
|  
|不支持的算法|CREATE TABLESPACE xxx  ENCRYPTION USING 'AES256' ENCRYPT|失败|  
|
|  
|USING 拼写错误|CREATE TABLESPACE xxx  ENCRYPTION USEING 'AES256' ENCRYPT|失败|  
|
|  
|顺序错误|CREATE TABLESPACE xxx  ENCRYPTION ENCRYPT USING 'AES256';|失败|  
|


功能场景

|  
|  
|场景|预期|
|---|---|---|---|
|表空间|升级|升级前创建AES128算法加密表空间，并创建表,索引，ac，升级后查询，覆盖三种表类型|成功|
|  
|  
|升级前创建AES128算法加密表空间，升级后在旧表空间创建表，索引，ac；验证加解密功能，覆盖三种表类型|  
|
|  
|  
|旧版本的备份集，升级后dba_backup_set字段加密字段不变。|  
|
|  
|两种加密算法混合使用，lsc表在数据转冷后再查，保证加密|有依赖关系的对象。表和索引，表和AC。表/索引/AC的分区在不同加密算法的表空间上。查询索引/ac数据并回表，同时使用到索引和表的数据，覆盖两种表类型|  
|
|  
|  
|没有依赖关系的对象。表1和表2在不同加密算法的表空间上,一条查询语句包含两表，覆盖两种表类型|  
|
|  
|  
|同一对象同时使用两种加密算法的表空间。表/索引分区在不同加密算法的表空间上，覆盖两种表类型。|创建成功|
|  
|HA|AES128加密方式的主备复制|成功，增加一个AES128加密方式的主备同步用例，可以加在旧用例中|
|  
|  
|备份|增加一个AES128表空间备份用例，可以加在旧用例中|
|  
|性能|tpcc 性能对比，修改用户默认表空间SM4加密表空间，对比AES128、非加密表空间|优先级低，可sit做,无指标要求，作为摸底，只有性能下降非常多需要分析|
|备份恢复|backup database encryption|不指定时查看视图DBA_BACKUP_SET的字段  ENCRYPT_ALGO值准确  ，备份恢复成功|不指定时默认采用AES128加密算法 → 默认采用SM4。有旧用例看护，无需新增用例|
|  
|归档备份|归档备份指定加密方式|已有归档备份指定SM4/AES128加密方式用例，无需新增用例,  
|


不用全量，只挑选部分功能用例

# 4. 测试用例

冒烟用例：

  


文本用例：

# 5. 测试框架设计

- yasft实现


# 6. 测试环境说明

*单机测试，集复用单机用例，可能需要少量修改*

# 7. 工作量评估

工作量：1  *人周*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWI4OTcwYzJhZjRmNTIxMDUwIiwicmVmX2lkIjoiNjczOTZkMWI1OTNmOTljOWZmMjM3N2NkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODgyLCJleHAiOjE3ODIzOTIyODJ9.hQTIxO41CMgwBvmg2tsUsV3fGSJfkvlHascV4zLbGXI)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWI4OTcwYzJhZjRmNTIxMDUwIiwicmVmX2lkIjoiNjczOTZkMWI1OTNmOTljOWZmMjM3N2NkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODgyLCJleHAiOjE3ODIzOTIyODJ9.hQTIxO41CMgwBvmg2tsUsV3fGSJfkvlHascV4zLbGXI)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWNhMWFkOWEzMzExZGM4ZWMwIiwicmVmX2lkIjoiNjczOTZkMWI1OTNmOTljOWZmMjM3N2NkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODgyLCJleHAiOjE3ODIzOTIyODJ9.gVa3KtHUESQVG6jfJI3j6jUoGIJYCuWld-47QlZ0XcY)

 (application/msword)    


[冒烟用例TDE和备份加密支持国密-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWNhMWFkOWEzMzExZGM4ZWMxIiwicmVmX2lkIjoiNjczOTZkMWI1OTNmOTljOWZmMjM3N2NkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODgyLCJleHAiOjE3ODIzOTIyODJ9.uyh4H8-qS4coKFgtfng8nRzCM1YzfGHmmzUE6_x4cYU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[TDE和备份加密支持国密-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWM4OTcwYzJhZjRmNTIxMDUyIiwicmVmX2lkIjoiNjczOTZkMWI1OTNmOTljOWZmMjM3N2NkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODgyLCJleHAiOjE3ODIzOTIyODJ9.aO3EVeKO3F3XIpIwxgh87oacBzt7hdXo11FnW3cPOmc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-26551TDE和备份机密支持国密算法.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWM4OTcwYzJhZjRmNTIxMDUzIiwicmVmX2lkIjoiNjczOTZkMWI1OTNmOTljOWZmMjM3N2NkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODgyLCJleHAiOjE3ODIzOTIyODJ9.JLM4JEz4GMba12jkYCrLbtwWcQ4_opS3LhF1rZhMQgQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,创建加密表空间有差异点，和本次转测无关,1、  第一种语句创建对象时需要显式指定加密选项。在这种情况下，每个对象（例如表或索引）都必须在创建时显式指定加密选项。第二种表明默认情况下该表空间中的数据将被加密存储，但不需要在每个表或索引上显式地指定加密选项,1). create tablespace big_tbs1 datafile 'big_tbs1' size 10m encryption using 'aes128' encrypt;,2). create tablespace big_tbs1 datafile 'big_tbs1' size 10m encryption using 'aes128' DEFAULT STORAGE(ENCRYPT);,  
,2、oracle 有参数  TABLESPACE_ENCRYPTION_DEFAULT_ALGORITHM  指定数据库在加密表空间时使用的缺省算法。,  
,3、oracle有参数ENCRYPT_NEW_TABLESPACES  指定是否对新创建的用户表空间进行加密。,Posted by chenrui at 四月 28, 2024 10:50|
|---|
|  [](null)  ,测试设计评审纪要：,与会人：崔园园、高亚宁、陈瑞、苏凡、刘大境    
  评审时间：2024-04-28 16:00-16:30    
  评审地点：线上,会议主题：【外键引用目标表字段信息支持可选】测试设计  评审,评审纪要信息：,1、语法无效类补充  --高亚宁,2、ac和表在不同表空间上，之前转测加密表空间，ac未转测，可以加固,结论：,1、语法无效类补充  --补充测试点,2、ac和表在不同表空间上 --加固测试可能已经有补充，侧重发散ac 和 表在不同算法表空间上。,3、升级场景表类型覆盖到lsc和heap。 ,  
,已检查测试点已覆盖，评审通过,  
,Posted by chenrui at 四月 28, 2024 17:43|
