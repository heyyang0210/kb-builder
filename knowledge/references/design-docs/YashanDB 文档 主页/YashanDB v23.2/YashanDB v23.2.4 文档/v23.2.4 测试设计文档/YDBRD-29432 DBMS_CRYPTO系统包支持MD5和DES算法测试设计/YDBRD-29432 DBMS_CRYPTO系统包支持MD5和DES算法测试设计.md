Created by 袁芳达, last modified on 十月 15, 2024

# 1. 概述

## DBMS_CRYPTO高级包添加  3种算法（  DES/3DES、MD5  ）

开发设计文档：    [DBMS_CRYPTO系统包支持MD5和DES算法](159424221.html)  

sr链接：    [https://pingcode.yasdb.com/pjm/items/66738dda288e197820a9842f](https://pingcode.yasdb.com/pjm/items/66738dda288e197820a9842f)    ?    
  #YDBRD-29432 【安全】DBMS_CRYPTO系统包支持MD5和DES算法

# 2. 需求分析

## 在DBMS_CRYPTO高级包中添加3种DES/3DES、MD5算法，用以替换Oracle的  DBMS_OBFUSCATION_TOOLKIT

## 2.3 规格约束

- ## DBMS_CRYPTO高级包的  3种算法（  DES/3DES、MD5  ）与  DBMS_OBFUSCATION_TOOLKIT的表现一致


# 3. 详细测试设计

## 3.1 测试设计方法

采用等价类、边界值的测试设计方法，对高级包的功能进行验证，同时考虑高级包的入参及返回值。下面分别对本 SR 中的 3 个算法DES/3DES、MD5进行测试设计：

## 3.2 详细测试设计

|类型|算法名|测试场景|预期结果|备注|
|---|---|---|---|---|
|功能测试|ENCRYPT_DES|1、入参：src、key、 RAW 类型，iv 为null,typ 指定为：ENCRYPT_DES + DBMS_CRYPTO.CHAIN_CBC + DBMS_CRYPTO.PAD_NONE，,调用高级包 ENCRYPT 函数对数据进行加密；  key 的长度必须是 8字节(补充参数校验验证),2、再调用高级包 DECRYPT 函数对数据进行解密；|对加密后的数据进行解密，与 src 入参内容一致(与 oracle DBMS_OBFUSCATION_TOOLKIT的结果进行比对)|  
|
|  
|ENCRYPT_3DES|1、入参：src、key、 RAW 类型，iv 为null,typ 指定为：ENCRYPT_DES + DBMS_CRYPTO.CHAIN_CBC + DBMS_CRYPTO.PAD_NONE，,调用高级包 ENCRYPT 函数对数据进行加密；,key 的长度必须是 24字节(补充参数校验验证,  
,2、再调用高级包 DECRYPT 函数对数据进行解密；|对加密后的数据进行解密，与 src 入参内容一致(与 oracle DBMS_OBFUSCATION_TOOLKIT的结果进行比对)|  
|
|  
|HASH_MD5|入参 src 为 RAW 类型，typ 指定为 DBMS_CRYPTO.HASH_MD5，调用高级包 HASH 函数|执行成功，生成的 HASH 值正确(与 oracle DBMS_OBFUSCATION_TOOLKIT的结果进行比对)|  
|
|参数校验|ENCRYPT_DES,ENCRYPT_3DES|入参校验：src、key、iv 为非 RAW 字符串类型，  非 RAW 类型的支持隐式转换；  比如: 非 16 进制数据、中文、null、‘’，调用高级包 ENCRYPT 函数,  
|执行加密/解密函数报错，错误信息正确|  
|
|  
|  
|入参 typ 指定为目前暂不支持取值：比如：ENCRYPT_AES256、CHAIN_CFB、PAD_PKCS5、其他值、null 、‘’，调用高级包 ENCRYPT 函数,组合必须都存在，否则报错,常量对标 oracle；|执行加密/解密函数报错，错误信息正确|  
|
|  
|  
|入参 RAW 类型长度及特殊值验证，覆盖：1、8000、8001|1、1~8000 范围内的数据，加密、解密函数执行成功，数据正确,2、8001 的数据，加密、解密函数执行失败，错误信息正确|  
|
|  
|  
|类型为 RAW 类型的入参为函数，比如 cast('aa' as raw(5))|对加密后的数据进行解密，与 src 入参内容一致|  
|
|  
|  
|使用参数名 => 参数值的方式，改变参数顺序调用高级包函数|对加密后的数据进行解密，与 src 入参内容一致|  
|
|  
|  
|使用  typeof() 函数验证函数返回值|类型为 RAW|  
|
|  
|  
|调用的高级包名、函数名大小写验证|不区分大小写，执行成功|  
|
|  
|  
|绑定参数的方式执行高级包函数|对加密后的数据进行解密，与 src 入参内容一致|  
|
|  
|HASH_MD5|入参校验 src 类型验证：不是 RAW 类型|执行报错，错误信息正确|  
|
|  
|  
|入参校验 typ 验证：    `HASH_MD4、其他值、null、'' 等`  |执行报错，错误信息正确|  
|
|  
|  
|入参 RAW 类型长度验证，覆盖：1、8000、8001|1、1~8000 范围内的数据，hash 函数执行成功，数据正确,2、8001 的数据，hash 函数执行成功，错误信息正确|  
|
|  
|  
|src 入参为函数，比如使用 cast 函数转成 RAW|执行成功，生成的 HASH 值正确(与 oracle 进行比对)|  
|
|  
|  
|使用参数名 => 参数值的方式，改变参数顺序调用高级包函数|执行成功，生成的 HASH 值正确(与 oracle 进行比对)|  
|
|  
|  
|使用  typeof() 函数验证函数返回值|类型为 RAW|  
|
|  
|  
|调用的高级包名、函数名大小写验证|不区分大小写，执行成功|  
|
|  
|  
|绑定参数的方式执行高级包函数|执行成功，生成的 HASH 值正确(与 oracle 进行比对)|  
|
|部署模式|  
|1、单机上执行高级包的ENCRYPT_DES,ENCRYPT_3DES,HASH_MD5|1、高级包执行成功|  
|
|权限验证|  
|sys 用户执行高级包的ENCRYPT_DES,ENCRYPT_3DES,HASH_MD5|1、高级包执行成功|  
|
|  
|  
|非 sys 用户执行高级包ENCRYPT_DES,ENCRYPT_3DES,HASH_MD5|1、执行失败，不存在|  
|


|系统级DFX分类|是否涉及|
|---|---|
|CT|不涉及|
|KT|不涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYWU4OTcwYzJhZjRmNTIxNDhjIiwicmVmX2lkIjoiNjczOTZkYWU1OTNmOTljOWZmMjM3ZTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNjIyLCJleHAiOjE3ODIzOTcwMjJ9.BzRQQsx2GWY4lhIxz2G-7VpUD37Dwk81HZLwXYFI-J4)

## Attachments:

[YDBRD-26603 & YDBRD-26602 支持DBMS_CRYPTO内置系统包的加解密函数 & HASH函数.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYWVhMWFkOWEzMzExZGM5MmZmIiwicmVmX2lkIjoiNjczOTZkYWU1OTNmOTljOWZmMjM3ZTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNjIyLCJleHAiOjE3ODIzOTcwMjJ9.Ej63tFJ9ieTBPEi8kevrMvHYeRxLt2Dff4NeENIrCGA)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYWU4OTcwYzJhZjRmNTIxNDhjIiwicmVmX2lkIjoiNjczOTZkYWU1OTNmOTljOWZmMjM3ZTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNjIyLCJleHAiOjE3ODIzOTcwMjJ9.BzRQQsx2GWY4lhIxz2G-7VpUD37Dwk81HZLwXYFI-J4)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYWU4OTcwYzJhZjRmNTIxNDhkIiwicmVmX2lkIjoiNjczOTZkYWU1OTNmOTljOWZmMjM3ZTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNjIyLCJleHAiOjE3ODIzOTcwMjJ9.seDEGq8sv2JwRsGRDmWn9Wrnq_99JyZ1T-iR6iYhvYI)

 (application/msword)    


## Comments:

|  [](null)  ,1.dblink，用Oracle的  DBMS_OBFUSCATION_TOOLKIT加密的数据可以用DBMS_CRYPTO解密,2.不同加密算法互转不会引起数据库异常,3.key长度,4性能表现摸底测试,  
,  
,Posted by yuanfangda at 七月 17, 2024 14:26|
|---|
