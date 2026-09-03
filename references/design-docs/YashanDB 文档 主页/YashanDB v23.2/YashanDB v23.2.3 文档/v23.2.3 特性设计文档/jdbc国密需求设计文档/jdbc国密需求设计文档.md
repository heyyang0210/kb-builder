Created by 张周玺, last modified on 六月 13, 2024

*详细设计-YDBRD-XXXX : XXX Design（XXX方案设计）*

*IR链接：*

  [https://pingcode.yasdb.com/pjm/items/66188960fd997db58ad7ab42](https://pingcode.yasdb.com/pjm/items/66188960fd997db58ad7ab42)    *?*    
  *#YDBRD-26095 【JDBC】通信加密算法兼容TLCP和TLS*

  [https://pingcode.yasdb.com/pjm/items/661888edfd997db58ad7ab19](https://pingcode.yasdb.com/pjm/items/661888edfd997db58ad7ab19)    *?*    
  *#YDBRD-26094 【JDBC】适配登录协议改造，使之满足GB15843标准*

  [https://pingcode.yasdb.com/pjm/items/66188838fd997db58ad7aac4](https://pingcode.yasdb.com/pjm/items/66188838fd997db58ad7aac4)    *?*    
  *#YDBRD-26093 【jdbc】适配口令加密算法满足国密算法*

*SR链接：YDBRD-XXXX*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

JDBC适配国密算法，包括tlcp连接，以及sm3加密算法，支持ukey等。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

原始的客户需求描述。关注需求的来源、规格、合理性，要用明确的语言描述，不能模棱两可。要把客户的业务场景描述清楚，知道客户希望怎么用，而且除了功能特性要求，也要尽可能了解非功能特性要求，例如性能、安全等。

**需求来源要说明特性支持的部署形态为 主备(单机)、分布式、集群，部分特性视情况下需要细分行存和列存。**

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

**概述**     友商相似需求的实现情况，详细调研在在调研文档中展开，要体现调研要素的全面，由另一个文档阐述。为了避免头重脚轻，调研不用在本文档展开。

*可以在这个章节从功能、性能等各维度比对友商方案，以及我们的设计方案。*

  


达梦的实现中，gmssl,ukey，加密算法这些也都是定义了native接口，然后通过C代码具体实现的。所以咱们在实现方式上和达梦保持对齐。

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|支持tlcp通信|在ssl socket的基础上增加一种tlcp socket|是|是|
|功能|支持SM3加密|把原加密方式改成SM3|是|是|
|功能|支持UKey和sm4|从ukey驱动读ukey信息，通过sm4加密后传给服务端|是|是|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

配置参数：

|功能模块|参数|备注|
|---|---|---|
|###   [支持tlcp通信](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  |tlcpCacertFile|证书生成方式见：    [复制从 TLCP - 程康 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150605435)     证书制作    
    
    
    
|
||tlcpCertFile||
||tlcpClientKeyFile||
||tlcpClientKeyPass||
|###   [支持UKey](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  |uKeyName|  
|
||uKeyPin|  
|


本需求只涉及内部通信、加密方式的改动，不涉及接口层面改动，无新增接口。

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**说明从SR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**     规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

这些特性需要调  yasjdbc库，需要把yasjdbc.dll或者yasjdbc.so库文件放在java.library.path可以加载到的路径下：默认情况下java.library.path包含如下路径，此外也可以通过jvm启动参数设置java.library.path的值。

 1  ）和  jre  相关的一些目录    
   2  ）程序当前目录    
   3  ）  Windows  目录    
   4  ）系统目录（  system32  ）    
   5  ）系统环境变量  path  指定目录（windows）或LD_LIBRARY_PATH指定目录（Linux）

  


**tlcpCacertFile等这些证书路径的最大长度应该小于256个bytes**

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

tlcp,sm3,读取ukey的基础能力都由C代码实现，打包成dll和so，供Java程序在需要时加载

###   [4.1 支持tlcp通信](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

根据连接的第一次ack返回的encryptMode字段，

定义TLCP_MODE_SECURITY = 3，代表要使用TLCP协议进行连接，定义 send,recv等基础能力接口，由C去实现，java通过JNI机制来调用。

jni具体接口：

|返回值|方法名|参数|说明|
|---|---|---|---|
|int |initEnv|无|动态加载库函数，环境初始化，完成连接前的准备工作.,返回值小于0代表失败。|
|int|socket|GmsslSocket gmsslSocket  ,   String caCert  ,   String certFile  ,   String clientKeyFile  ,    
                                    String clientKeyPass|建立连接。,返回值小于0代表失败。|
|int |send|GmsslSocket gmsslSocket  , byte  [] bArr  , int   i|数据发送。,返回值小于0代表失败。|
|int|recv|GmsslSocket gmsslSocket  , byte  [] bArr| 数据接收，head和内容的读取都在C里面实现，完成后一起返回回来。方法返回值是数据长度。,返回值小于0代表失败。|
|int|close  ()  ;|GmsslSocket gmsslSocket|关闭连接。,返回值小于0代表失败。|


###   [4.2 支持SM3加密](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

根据  CMD_LOGIN的返回，

encryVersion字段，定义  ENCRY_VERSION_SM3 = 2，如果服务端返回ENCRY_VERSION_SM3，就把加密方式改成SM3.    
    
    
    


###   [4.3 支持UKey和sm4](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

根据  CMD_LOGIN的返回，

transEncryVersion字段，定义

SYM_ENCRY_VERSION_SM4_CBC  = 3，

SYM_ENCRY_VERSION_ECC  = 4

如果服务端返回SYM_ENCRY_VERSION_SM4或

SYM_ENCRY_VERSION_ECC  ，就把加密方式改成SM4.    
  如果是  SYM_ENCRY_VERSION_ECC，最后面再加上一步ukey加密。

jni具体接口：

|返回值|方法名|参数|说明|
|---|---|---|---|
|int |initEnv|无|动态加载GM库函数，环境初始化.,  
|
|String|encryptSm3  ()|String data  ,   String[] salt,int count|,使用Sm3算法进行加盐加密  。,返回字符串类型的加密结果，先试试，如果不能正常返回结果的话，改成通过入参返回结果。|
|byte|decryptSM4|byte  [] key  , byte  [] data|使用Sm4算法进行解密  。,  
|
|String|encryptSm4  ()|String data  , byte[] key|使用Sm4算法进行加盐加密  。,返回字符串类型的加密结果，先试试，如果不能正常返回结果的话，改成通过入参返回结果。|
|int |initUkeyEnv|无|动态加载UKEY库函数，环境初始化.,  
|
|byte  []|uKeySign|byte  [] data,  ,  String ukeyName  ,  String ukeyPin|根据ukeyName，ukeyPin来打开ukey。然后把clientRandom和serverRandom进行加密|


  
  所有String全换成byte[],加上length.    
    


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

1. 测试tlcp场景。
1. 测试sm3场景。
1. 测试sm4场景。
1. 测试sm4+ukey场景。
1. 以上场景 只要能正常登录，正常操作业务就算成功。
1. 各种环境测试。


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。