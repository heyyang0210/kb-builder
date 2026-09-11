Created by 杜卓林, last modified on 九月 23, 2024

# 1. 概述

SR：       [https://pingcode.yasdb.com/pjm/items/66864266288e197820b64aa3](https://pingcode.yasdb.com/pjm/items/66864266288e197820b64aa3)    ?#YDBRD-30058 【安全】信创版本软件完整性校验

开发设计文档：    [YDBRD-30058：信创版本软件完整性校验设计文档 - 贺国锋 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=163008188)  

开发调研文档：    [YDBRD-30058：信创版本软件完整性校验调研文档 - 贺国锋 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=163006653)  

SR：    [https://pingcode.yasdb.com/pjm/items/66bad03066228b94707e32df](https://pingcode.yasdb.com/pjm/items/66bad03066228b94707e32df)    ?#YDBRD-31449 【安全】加密引擎适配sm2/sm3签名认证接口

开发设计文档：    [YDBRD-31449:加密引擎适配sm2/sm3签名认证接口设计文档 - 贺国锋 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=167163260)  

  


**背景**  ：

**需求描述**  ：   在软件发布之时，对yasdb和各种库文件进行完整性校验，产生签名数据和对应公钥。    
  软件启动时，自动检测签名是否正确，如果不正确则停止启动。

**需求范围**  ： 单机、分布式、集群

  


# 2. 需求分析

## 2.1 功能点分析

1、提供签名工具--  yassign  

使用  ：在tools下面提供yassign工具，输入参数为需要进行签名的文件或者路径，若为路径，则按照字母顺序，在签名时对路径下的文件进行排序。

     签名工具执行完毕后，在标准输出上输出签名和公钥。

     输出的签名和公钥使用AES128对称加密算法进行加密，加密密钥采用编译时的GIT版本号，进行50次SM3 Hash后生成。

上车后，release版本包中删除该工具，用户不感知。

  


2、软件包构建时生成签名和公钥

使用：  在install步骤结束后，根据install安装的路径，对install/lib目录和install/bin/yasdb文件进行数字签名，生成加密后的签名数据和签名公钥。

签名数据和签名公钥保存在conf目录下的signature.ini中。

  


3、yasdb软件启动时进行签名效验

使用：  yasdb在启动时，从conf目录下的signature.ini中读取加密后的签名和公钥，然后利用相同的方式生成自己的AES128的解密密钥，对签名和公钥解密。

    然后利用解密获取的公钥，对签名数据进行验签。

    若效验通过，则正常启动，否则报错退出。

##   
  2.2 规格约束

1、yassign工具，测试完成后上车前需要从发布包中去除。用户不可见

2、签名的lib库中排除第三方的lib库

  


# 3. 详细测试设计

## 3.1 测试设计方法

从功能出发，结合等价类、场景法的测试设计方法，同时考虑加解密函数的入参及返回值，输出测试设计。

  


## 3.2 详细测试设计

测试策略：

1、验证数据类型及取值范围，预期与设计文档一致

2、使用yasql客户端，结合不同算法的对应关系，交叉验证被测函数的基本功能

|  
|场景|形态|操作|预期|
|---|---|---|---|---|
|软件完整性校验|安装（yasboot工具）|  
  单机：单节点    
  分布式：1mn，1cn，3dn    
  集群：两主节点（分布在2台机器）,  
,--  测试场景更改  ：安装 & 卸载后重部署|下载  debug版本  ，进行 config→ install→ deploy,（用户使用时默认操作，除安装部署等正常流程外，无需额外进行安装包加解密操作）|签名和yasdb启动时的校验动作，用户不感知。用户感知是否可以正常安装部署|
|  
|||下载发布版本，使用yassign工具进行对称加密，算法为AES128，加密密钥为git号。加密完成后进行 config→ install→ deploy ,（主要测试yassign工具是否存在bug）|正常安装部署|
|  
|||下载发布版本，使用yassign工具进行对称加密，  ~~算法为SHA256/SM2/SM3，加密密钥为git号。加密完成后进行 config→ install→ deploy~~    
  （主要测试yassign工具是否存在bug）,--调用工具对某路径下的文件进行加密    
  --install/lib目录新增三方库，改动signature.ini中内容，进行验证|由于加密算法不一致，加密失败，进行config→ install→ deploy时提示安装包未进行安全性校验。（但安装部署会成功）,  
,-- 改动后部署失败|
|  
|||下载发布版本，在install路径下，找到签名数据和签名公钥并进行  **修改**  ，然后进行部署|部署失败，提示错误信息为文件未通过安全性校验|
|  
|||下载发布版本，在install路径下，  **删除**  签名数据和签名公钥所在的文件，然后进行部署|部署失败，提示错误信息为未找到安全性校验文件|
|  
|~~升级、回退~~||~~对部署成功的数据库进行升级操作，新的版本包自动进行安全性校验，无需手动操作~~|~~升级成功~~|
|  
||~~对部署成功的数据库进行回退操作，新的版本包自动进行安全性校验，无需手动操作~~||~~回退成功~~|
|  
|卸载后重新部署||卸载已安装成功的数据库，重新安装部署。|重新安装部署时，执行install是自动校验加密文件，重安装成功|
|  
|~~扩缩容~~||~~进行扩缩容操作，执行成功~~|  
|
|  
|主备高可用部署|单机、分布式|单机：一主两备    
  分布式：1MN组（3MN：一主两备）、1CN组（3CN：一主两备）、3DN组（每组3CN：一主两备）|验证安装包完整性后，正常安装部署|
|加密引擎适配sm2/sm3签名认证接口|修改加密算法库：    
  原算法库：OPENSSL    
  新算法库：GMSSL、PCIE||ALTER SYSTEM SET   ENCRYPT_ENGINE_TYPE ='GMSSL' scope = spflie;,  
|目前表现为重启生效    
  建议改为：建库后不可修改，即使在ini文件中修改，但不生效,--本SR改动|
|  
|参数验证    
    
    
|crypt_key|  
    [YDBRD-26674 【安全】支持对称和非对称加解密内置函数测试设计 - 杜卓林 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153018976)      
    [YDBRD-26675 : 支持密钥摘要等内置函数测试设计 - 杜卓林 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153017111)  ,参数验证用例参考之前测试方案设计,**--补充**  更多的特殊字符串，关注之前问题单：YDBRD-30103 。验签时测试公钥私钥两种输入,--长度边界值（string类型长度）,- SM2加解密   -----  crypt_encrypt、crypt_decrypt
- SM2签名/验签   -----  crypt_sign、crypt_verify
- SM3   -----  crypt_hash、crypt_hmac
- SM2密钥生成   -----  crypt_key
|  
|
|  
||crypt_hash||  
|
|  
||crypt_hmac||  
|
|  
||crypt_sign||  
|
|  
||crypt_verify||  
|
|  
||crypt_asym_encrypt('abc', 'public...key...')  (非对称加解密)||  
|
|  
||crypt_asym_decrypt('abc', 'private...key...')||  
|
|  
|权限|  
|sys/dba用户、普通用户执行上述函数|由于上述函数为系统新增安全函数，非高级包函数，因此不区分权限，均可执行|
|  
|加解密正确性|加解密函数crypt_encrypt、crypt_decrypt    
  --crypt_sign、crypt_verify验证,--hash\hmac验证正确性，和网站加密结果一致    
  --crypt_key签名验签通过，非对称加解密成功|通过加解密函数嵌套，进行正确性验证。（嵌套2、3层）|嵌套2、3层加密解密函数后，最终得到正确的原文|
|  
|签名&验签函数|crypt_sign、crypt_verify|签名数据和签名公钥算法一致|成功|
|  
|  
||签名数据和签名公钥算法不一致|报错|
|  
|系统视图是否脱敏|  
|查询 V$SQLTEXT / v$sql / v$sqlarea 视图中的SQL语句是否脱敏|--是否支持？,--当前不支持，但需要脱敏（先提单）,问题单：,  [https://pingcode.yasdb.com/pjm/items/66ed4b578f5ee191735b254a](https://pingcode.yasdb.com/pjm/items/66ed4b578f5ee191735b254a)    ?    
  #YDBRD-33094 【安全】系统视图未对历史SQL文本中待加密的明文数据进行脱敏处理|
|  
|其他场景|insert 插入数据时，使用上述函数，覆盖DML语句|  
|插入成功|
|  
|字符集|默认UTF-8|指定不同字符集，在不同字符集下加密结果可不一致，但均能正确解密回原文      
  utf-8 / utf-8     
  utf-8 / GB1321 (会有乱码)|  
|
|资料测试|  
|资料测试,crypt_key、crypt_hash、crypt_hmac、crypt_sign、crypt_verify    
  crypt_encrypt、crypt_decrypt    
  crypt_asym_encrypt、crypt_asym_decrypt|  
|  
|


## **函数具体规格**

|函数|定义|规格|说明|返回值|
|---|---|---|---|---|
|crypt_key|CRYPT_KEY= CRYPT_KEY"(" expr1")"|   expr1是加密算法，支持VARCHAR类型，  支持SM2    
  -  当  expr1不在支持列表中时，函数报错  。|以expr1为待创建的密钥类型  ，返回一个HEX形式的  VARCHAR  类型的公私密钥对|PUB:XXXX;PRI: XXXX|
|crypt_sign|CRYPT_SIGN::= CRYPT_SIGN"(" expr1 "," expr2 "," expr3 ")"|expr1是需要签名的数据，支持VARCHAR类型。    
    
  -   expr2是签名者需要提供的私钥，支持VARCHAR类型，可以通过内置函数crypt_key函数获取。若为NULL则报错。,-     expr3是签名者提供的私钥算法，支持VARCHAR类型，  支持'SM2'加密算法  。若为NULL或类型不对则报错。  -   expr1若为NULL，则返回NULL。|CRYPT_SIGN  函数可以对数据进行签名，,返回HEX形式的签名后的字符串|签名后的字符串（HEX格式）|
|crypt_verify|CRYPT_VERIFY::= CRYPT_VERIFY"(" expr1 "," expr2 "," expr3 "," expr4 ")"|expr1是需要验签的数据，支持VARCHAR类型。    
    
  - expr2是签名数据，支持VARCHAR类型  。,-     expr3是签名的公钥，支持VARCHAR类型。不指定则报错。  -   expr4是签名公钥的算法，支持VARCHAR类型，支持'SM2'加密算法。若为NULL或类型不对则报错。  -   expr1或expr2若为NULL，则返回FALSE。|CRYPT_VERIFY可以对已经签名的数据进行验签|TRUE或FALSE，TRUE表示验签成功，FALSE表示验签失败|
|crypt_hash|CRYPT_HASH::= CRYPT_HASH"(" expr1 "," expr2 ")"|```
'SM3'
```,-   expr1若为NULL，则返回值为NULL  。|CRYPT_HASH  函数对输入的数据生成HASH摘要|字符串（HEX格式）|
|crypt_hmac|CRYPT_HMAC::= CRYPT_HMAC"(" expr1 "," expr2 "," expr3 ")"|expr1是需要生成摘要的数据，支持VARCHAR类型。    
    
  -   expr2是MAC算法的类型，支持VARCHAR类型，仅支持  'SM3'  。若为NULL或类型不支持则报错。,-     expr3是提供的密钥，支持VARCHAR类型。,-   expr4是可选参数，用来指示exp1、expr3的数据类型是否为HEX形式。当前默认为字符串形式，只能输入默认值格式。,-   expr1若为NULL，则返回值为NULL。|CRYPT_HMAC  函数可以对数据依据HMAC算法生成摘要|字符串（HEX格式）|
|非对称加密  crypt_asym_encrypt|select crypt_asym_encrypt('abc', 'public...key...'),  
|第一个参数是明文，string。,第二个参数是用于加密的公钥。,  
,输出：HEX格式的密文。,算法：SM2|输入明文string类型的源数据,返回加密后的 hex数据。,  
|HEX格式的密文。|
|非对称解密  crypt_asym_decrypt|select crypt_asym_decrypt('abc', 'private...key...')|第一个参数是密文，总是HEX格式。,第二个参数是用于解密的私钥。,  
,输出：字符串。,算法：SM2|输入加密后的 hex数据,返回解密后的string类型的源数据，与对称加密函数的输入一致|返回解密后的string类型的源数据|


  


*2、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|/|
|KT|/|
|长稳|/|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|安全|涉及|
|DFR|/|
|HA|涉及|
|压力|/|
|性能|/|
|可维护性|/|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

不涉及

# 6. 测试环境说明

*不涉及*

# 7. 工作量评估

工作量：1  *人周*

计划测试完成时间：

  


  


## Attachments:

[YDBRD-30058_31449_文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTRhMWFkOWEzMzExZGM5NDIxIiwicmVmX2lkIjoiNjczOTZkZTQ3MjgyMDZlZmI5MmYyNDQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTQ3LCJleHAiOjE3ODIzOTkzNDd9.XZCOicbItEp6awFbCXQVY6n_TwHVwJJFmFlaYaJBAq0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-30058_31449_文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTRhMWFkOWEzMzExZGM5NDIyIiwicmVmX2lkIjoiNjczOTZkZTQ3MjgyMDZlZmI5MmYyNDQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTQ3LCJleHAiOjE3ODIzOTkzNDd9.nx_5q7ULCA45511zxE52LP_yMrH371xMEzBV9pRozak)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：,与会成员：赵育;孙志祥;贺国锋(Nelson);冯皓博;杜卓林;,软件完整性校验：    
  1、采用debug版本测试    
  2、验证yassign工具方法：采用对用户增加的三方库文件进行加密，并修改加密文件（signature.ini），然后进行安装部署。预期为部署失败,加密引擎适配sm2/sm3签名认证接口：    
  1、加密算法库参数：ENCRYPT_ENGINE_TYPE 修改为建库参数。（建库后不可修改/修改无效）    
  2、加解密函数为”非对称加解密“    
  3、函数参数验证时需要关注    
  补充更多的特殊字符串，关注之前问题单：YDBRD-30103 。验签时测试公钥私钥两种输入    
  长度边界值（string类型长度）验证    
  4、采用正向加密/签名、逆向解密/验签形式验证函数的正确性；其余函数正确性验证：执行结果与网站执行结果一致    
  5、系统视图需要对保存的SQL文本中加密的部分进行脱敏处理，可先提单，必要时上升CCB,Posted by duzhuolin at 九月 20, 2024 16:28|
|---|
|  [](null)  ,增加资料测试,  [CRYPT_KEY | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CRYPT_KEY.html)  ,Posted by duzhuolin at 九月 20, 2024 18:58|
