Created by 程康, last modified on 十一月 07, 2024

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

  [https://pingcode.yasdb.com/pjm/items/66c2a7c766228b94708022f4](https://pingcode.yasdb.com/pjm/items/66c2a7c766228b94708022f4)    ?    
  #YDBRD-31756 【安全】加密引擎适配sm4/ukey等接口

###   [1.2 调研文档](#12-调研文档)  

  


###   [1.3 需求分析](#13-需求分析)  

###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

|interface|调用接口|
|---|---|
|aniSM4CBCDecrypt|登录|
|aniSM4CBCEncrypt|登录|
|aniLoadPubKey|ukey登录|
|aniVerifyForUkeySign|ukey登录|
|aniSha256Str|DBMS_CRYPTO.Hash|


##   [3. 规格与约束](#3-规格与约束)  

  


##   [4. 特性](#4-特性)  

##### 如何验证：  aniSM4CBCEncrypt aniSM4CBCDecrypt 

  


client：

ENCRYPT_LIB=gmssl 可替换算法

  


server：

ENCRYPT_ENGINE_TYPE=pcie 可替换算法    
  PASSWORD_CRYPTO_METHOD=SM4

  


![](https://pingcode.yasdb.com/atlas/files/public/6739e3b1a1ad9a3311de25b6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ3MjksImV4cCI6MTc4MjMzNTUyOX0.0lWhCXpk2HLcA-9mPrkGgYEh0daUzxMQAiCYYpChkNQ)

  


##### 如何验证：  aniLoadPubKey  aniVerifyForUkeySign

  


参考     [pcie use - 程康 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/~chengkang/pcie+use)  

server：

ENCRYPT_ENGINE_TYPE=pcie 可替换算法

  


在 ukey的机器上 使用客户端。

当算法选择pcie库时，服务端也在ukey的机器上启动。

  


ukey登录流程参考：    [C驱动支持UKEY满足双因子认证 - YashanDB 文档 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150603854)  

##### 如何验证：  aniSha256Str

server：

ENCRYPT_ENGINE_TYPE=pcie 可替换算法

参考     [DBMS_CRYPTO | YashanDB Doc](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E9%AB%98%E7%BA%A7%E5%8C%85/DBMS_CRYPTO.html)  

  


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

关于ukey sm2验签，遇到的部分问题说明：    [sm2_verify - 程康 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/~chengkang/sm2_verify)  

##   [6.资料设计章节](#6资料设计章节)  

增加资料说明，

##   [7.未来规划](#7未来规划)  

## Attachments: