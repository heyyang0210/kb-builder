

# YDBRD-31452 【安全】加密引擎适配random/key相关接口

# 1. 概述

## 1.1 相关文档

SR:   [https://pingcode.yasdb.com/pjm/items/66bad0858f5ee191734cff19](https://pingcode.yasdb.com/pjm/items/66bad0858f5ee191734cff19)  ?    
  #YDBRD-31452 【安全】加密引擎适配random/key相关接口

开发设计文档：  [#YDBRD-31452 【安全】加密引擎适配random/key相关接口](https://conf.yasdb.com/pages/viewpage.action?pageId=177849267)  

个人调研文档：  [5.2【YDBRD-31452】Part1 个人调研](177833056.html)  

调研文档：

概要设计文档：

## 1.2 特性说明

对于random/key相关接口，原本只是在openssl下的，现在将适配gmssl和pcie。

# 2. 需求分析

## 2.1 功能点分析

![](https://pingcode.yasdb.com/atlas/files/public/67398fb5a1ad9a3311dd18e3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUlBSUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFFQUFBQUFBZ0FBQUFBQUFBQUFBQUFDQUlBQUFBQUFBQUFBQUFBSUFBQ0FBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQkFBQUFBQUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQyMDksImV4cCI6MTc4MjMzNTAwOX0.ufW93QOGkgXSFCiebVrIqCLs-CxI8HF0lMh8b-wJpUo)

  


|语法入口|  
|作用|
|:---|:---|---|
|### ENCRYPT_ENGINE_TYPE|取值范围/格式：[OPENSSL|GMSSL|PCIE]|使用什么库|
|  
|  
|  
|


## 2.2 应用场景

1）对于相同的业务，使用不同的ENCRYPT_ENGINE_TYPE，其结果需要一致。

2）

## 2.3 规格约束

1）  **gmssl 没有能力的，使用报错，起库成功**

2）windows客户端不支持pcie密码卡

3）  **密码卡不支持 ENCRYPT_ALGO_3DES_2KEY_CBC、ENCRYPT_ALGO_3DES_2KEY_CBC_PKCS7， 使用报错**

密码卡需要前置配置 （当天日期）

sudo touch /usr/DJCcdAPI/log/djccd_20241209.log

sudo chmod 646 /usr/DJCcdAPI/log/djccd_20241209.log

4）没有pcie环境：

a. ENCRYPT_ENGINE_TYPE=PCIE,  _CRYPTO_ENABLED = ON   起库报错

b. ENCRYPT_ENGINE_TYPE=PCIE,  _CRYPTO_ENABLED = OFF   起库成功（需要通过修改配置文件部署起库，不能修改参数后重启），使用报错

![image.png](https://pingcode.yasdb.com/atlas/files/public/6758f201a1ad9a3311de46cc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUlBSUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFFQUFBQUFBZ0FBQUFBQUFBQUFBQUFDQUlBQUFBQUFBQUFBQUFBSUFBQ0FBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQkFBQUFBQUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQyMDksImV4cCI6MTc4MjMzNTAwOX0.ufW93QOGkgXSFCiebVrIqCLs-CxI8HF0lMh8b-wJpUo)

5）



# 3. 详细测试设计

## 3.1 测试设计方法

## 3.2 详细测试设计

### 3.2.1 DFX测试

|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT并发|  
|  
|
|KT|  
|  
|
|长稳|  
|  
|
|一致性|  
|  
|
|三方测试工具  
(sqltest，sqlancer)|  
|  
|
|安全|是|下方说明|
|DFR故障|  
|  
|
|HA高可用|  
|  
|
|压力|  
|  
|
|性能|可摸底,,不同算法函数使用的性能对比|  
|
|可维护性|  
|  
|


### 3.2.2 等价类

不同  ENCRYPT_ENGINE_TYPE下，相关的函数/高级包的表现一致。不支持的合理报错

|序|类别|输入条件|有效等价类|备注|测试的接口|无效等价类|备注|
|---|---|---|---|---|---|---|---|
|1|功能|ENCRYPT_ENGINE_TYPE|OPENSSL,GMSSL,PCIE,  
|- 参数类型：字符串
- 默认值：OPENSSL
- 取值范围/格式：[OPENSSL|GMSSL|PCIE]
- 参数说明：加密引擎的类型。
- **修改立即生效：否**
- **会话级参数：否**
- 只读参数：否
,,||aaaaa|  
|
||||nomount mount 不同起库方式下|使用场景：,nomount ： sys用户登陆 ,mount ,open  ： 函数使用||||
|2|  
|  [crypt_selftest](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CRYPT_SELFTEST.html)  |CRYPT_SELFTEST('random',8),CRYPT_SELFTEST('random',16),CRYPT_SELFTEST('random',80),CRYPT_SELFTEST('random',8000),CRYPT_SELFTEST('random',80000),CRYPT_SELFTEST('random',125000)|CRYPT_SELFTEST函数,以  [expr1](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  为测试类型,以  [expr2](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  为数据长度进行条件自测试。,expr1  **仅支持random**  ，检查随机数的随机性。,expr2表示random的比特长度，应为8的整倍数，取值范围为[8,125000]|GenRandom|select CRYPT_SELFTEST('random',8001) from dual;,,,,,select CRYPT_SELFTEST('randon',8000) from dual;|YAS-00003 invalid parameter, reason: invalid random size,,,,YAS-00003 invalid parameter, reason: must be RANDOM|
|3|  
|  [PASSWORD_CRYPTO_METHOD ](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%9A%90%E8%97%8F%E5%8F%82%E6%95%B0.html)  |alter system set PASSWORD_CRYPTO_METHOD = SM4 scope=spfile;,alter system set PASSWORD_CRYPTO_METHOD = AES  scope=spfile;  
|**客户端**  密码登录的加密方式|SM4GenKey|  
|  
|
|4|  
|  [crypt_encrypt](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CRYPT_ENCRYPT.html)  |  
CRYPT_ENCRYPT('abc', 'sm4', 'CBC', '12345678901234567890123456789012', '12345678901234567890123456789012'),,CRYPT_ENCRYPT('abc', 'sm4', 'CBC', '12345678901234567ac0123456789012', '12345678901234567890123bb6789012'),,|CRYPT_ENCRYPT函数,以  [expr2](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  为算法类型、,以  [expr3](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  为算法模式、,以  [expr4](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  为HEX格式的密钥、,以  [expr5](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  为初始化随机数对  [expr1](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  进行加密，返回加密结果。,- expr2只支持SM4。
- expr3只支持CBC。
- expr4和expr5的值均为HEX格式，长度为32个字符。
- 当expr1为null时返回null。
|ENCRYPT_ALGO_SM4_CBC|  
|  
|
|5||  [DBMS_CRYPTO](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E9%AB%98%E7%BA%A7%E5%8C%85/DBMS_CRYPTO.html)  ,ENCRYPT/DECRYPT|DBMS_CRYPTO的加密类型,DBMS_CRYPTO.ENCRYPT_AES128、,|**指定不同的typ的值，对应不同的加密类型**|ENCRYPT_ALGO_AES_128_CBC = 1,ENCRYPT_ALGO_AES_128_CBC_PKCS7 = 10|||
|6|  
|  [DBMS_CRYPTO](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E9%AB%98%E7%BA%A7%E5%8C%85/DBMS_CRYPTO.html)  ,ENCRYPT/DECRYPT|typ =   **加密类型**   + 加密模式 + 填充模式  （形成一个加密操作类型）,,,DBMS_CRYPTO的加密类型,DBMS_CRYPTO.ENCRYPT_DES、,DBMS_CRYPTO.ENCRYPT_3DES、,DBMS_CRYPTO.ENCRYPT_3DES_2KEY，,,--------------------------------,分组加密模式支持,DBMS_CRYPTO.CHAIN_CBC，,填充模式支持,DBMS_CRYPTO.PAD_NONE、,DBMS_CRYPTO.PAD_PKCS7。|⭐此时GMSSL执行，预期报错,,DBMS_CRYPTO 用例：,  [https://git.yasdb.com/cod-test/yasft/-/merge_requests/8738](https://git.yasdb.com/cod-test/yasft/-/merge_requests/8738)  ,,加密解密对称|ENCRYPT_ALGO_DES = 5,    
  ENCRYPT_ALGO_DES_CBC = 11,    
  ENCRYPT_ALGO_DES_CBC_PKCS7 = 12,    
  ENCRYPT_ALGO_  **3DES**   = 6,    
  ENCRYPT_ALGO_  **3DES_CBC**   = 13,    
  ENCRYPT_ALGO_  **3DES_CBC_PKCS7**   = 14,    
  ENCRYPT_ALGO_  **3DES_2KEY_CBC**   = 15,    
  ENCRYPT_ALGO_  **3DES_2KEY_CBC_PKCS7**   = 12    
  ENCRYPT_ALGO_  **3DES_2KEY **  = 7,,![image.png](https://pingcode.yasdb.com/atlas/files/public/673c30858970c2af4f53b573/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUlBSUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFFQUFBQUFBZ0FBQUFBQUFBQUFBQUFDQUlBQUFBQUFBQUFBQUFBSUFBQ0FBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQkFBQUFBQUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQyMDksImV4cCI6MTc4MjMzNTAwOX0.ufW93QOGkgXSFCiebVrIqCLs-CxI8HF0lMh8b-wJpUo)||  
|
|7|  
|部署形态    |单机、分布式、集群  
||  
|  
|  
|
|8|  
|客户端  
|win\linux、jdbc 连接  
|登陆|  
|  
|  
|
||||没有密码卡的机器、指定PCIE。  起库正常、用函数的时候报错|||||
||||升级情况，是否使用到相关函数、高级包 -- 无此情况|||||
||||**不同节点、指定不同算法？**|||||
|||安全|相关视图中，加密的明文是否脱敏,V$SQLTEXT / v$sql / v$sqlarea|  [https://pingcode.yasdb.com/pjm/items/66ed4b578f5ee191735b254a?](https://pingcode.yasdb.com/pjm/items/66ed4b578f5ee191735b254a?)  ,#YDBRD-33094 【安全】系统视图未对历史SQL文本中待加密的明文数据进行脱敏处理||||


  


# 4. 测试用例

## 4.1 冒烟/文本用例



```

1、没有PCIE的机器，配置alter system set ENCRYPT_ENGINE_TYPE='PCIE' scope=spfile，预期起库成功，重启成功

2、只配置服务端。不同的配置、相同的sql和预期（GMSSL在不支持的情况下合理报错） 使用 CRYPT_SELFTEST、CRYPT_ENCRYPT、DBMS_CRYPTO

PASSWORD_CRYPTO_METHOD=AES   ENCRYPT_ENGINE_TYPE=OPENSSL 
PASSWORD_CRYPTO_METHOD=AES   ENCRYPT_ENGINE_TYPE=GMSSL
PASSWORD_CRYPTO_METHOD=AES   ENCRYPT_ENGINE_TYPE=PCIE
PASSWORD_CRYPTO_METHOD=SM4   ENCRYPT_ENGINE_TYPE=OPENSSL
PASSWORD_CRYPTO_METHOD=SM4   ENCRYPT_ENGINE_TYPE=GMSSL
PASSWORD_CRYPTO_METHOD=SM4   ENCRYPT_ENGINE_TYPE=PCIE


3、指定ENCRYPT_ENGINE_TYPE=OPENSSL，启动到，nomount状态下，执行相关的sql
=GMSSL
=PCIE
4、
```



自动化用例：

12个场景配置，每个场景6个测试点，共计用例72个

非自动化用例：

4个场景、每个场景6个测试点，共计24个  


```
1、ENCRYPT_ENGINE_TYPE=OPENSSL, DB STATUS=OPEN, PASSWORD_CRYPTO_METHOD=AES         执行sql1，预期out1
2、ENCRYPT_ENGINE_TYPE=OPENSSL, DB STATUS=OPEN, PASSWORD_CRYPTO_METHOD=SM4         执行sql1，预期out1
3、ENCRYPT_ENGINE_TYPE=OPENSSL, DB STATUS=NOMOUNT, PASSWORD_CRYPTO_METHOD=AES      执行sql1，预期out2
4、ENCRYPT_ENGINE_TYPE=OPENSSL, DB STATUS=NOMOUNT, PASSWORD_CRYPTO_METHOD=SM4      执行sql1，预期out2
5、ENCRYPT_ENGINE_TYPE=GMSSL, DB STATUS=OPEN, PASSWORD_CRYPTO_METHOD=AES           执行sql1，预期out3
6、ENCRYPT_ENGINE_TYPE=GMSSL, DB STATUS=OPEN, PASSWORD_CRYPTO_METHOD=SM4           执行sql1，预期out3
7、ENCRYPT_ENGINE_TYPE=GMSSL, DB STATUS=NOMOUNT, PASSWORD_CRYPTO_METHOD=AES        执行sql1，预期out2
8、ENCRYPT_ENGINE_TYPE=GMSSL, DB STATUS=NOMOUNT, PASSWORD_CRYPTO_METHOD=SM4        执行sql1，预期out2
(无PCIE)
9、ENCRYPT_ENGINE_TYPE=PCIE, DB STATUS=OPEN, PASSWORD_CRYPTO_METHOD=AES            执行sql1，预期out4
10、ENCRYPT_ENGINE_TYPE=PCIE, DB STATUS=OPEN, PASSWORD_CRYPTO_METHOD=SM4           执行sql1，预期out4
11、ENCRYPT_ENGINE_TYPE=PCIE, DB STATUS=NOMOUNT, PASSWORD_CRYPTO_METHOD=AES        执行sql1，预期out5
12、ENCRYPT_ENGINE_TYPE=PCIE, DB STATUS=NOMOUNT, PASSWORD_CRYPTO_METHOD=SM4        执行sql1，预期out5
(有PCIE)
13、ENCRYPT_ENGINE_TYPE=PCIE, DB STATUS=OPEN, PASSWORD_CRYPTO_METHOD=AES            执行sql1，预期out1
14、ENCRYPT_ENGINE_TYPE=PCIE, DB STATUS=OPEN, PASSWORD_CRYPTO_METHOD=SM4           执行sql1，预期out1
15、ENCRYPT_ENGINE_TYPE=PCIE, DB STATUS=NOMOUNT, PASSWORD_CRYPTO_METHOD=AES        执行sql1，预期out2
16、ENCRYPT_ENGINE_TYPE=PCIE, DB STATUS=NOMOUNT, PASSWORD_CRYPTO_METHOD=SM4        执行sql1，预期out2
```

# 5. 测试框架设计

- 如果用例不能实现自动化需要在此标注并说明原因
- 确认使用的测试框架及其满足度


1） 自动化用例：

Guider框架执行用例，生成预期，使用yasql模式执行。

使用导入导出框架进行测试  [https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/exp_imp_test](https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/exp_imp_test)  

# 6. 测试环境说明

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

1）辅助工具：

Guider部署、执行、字符集配置脚本：  [https://git.yasdb.com/xiezhaoxian/scripts](https://git.yasdb.com/xiezhaoxian/scripts)  

2）测试环境：

|  
|CPU|操作系统|可用内存|可用磁盘空间|磁盘类型|
|:---|:---|:---|:---|:---|:---|
|192.168.7.105|Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz|Linux AchorBase 3.10.0-1160.114.2.el7.x86_64|50G|303G|HDD|
|192.168.132.196 密码卡环境||||||


# 7. 工作量评估

工作量：天

计划测试完成时间：

  


## Attachments:



 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)  




 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)  




 (text/csv)  
