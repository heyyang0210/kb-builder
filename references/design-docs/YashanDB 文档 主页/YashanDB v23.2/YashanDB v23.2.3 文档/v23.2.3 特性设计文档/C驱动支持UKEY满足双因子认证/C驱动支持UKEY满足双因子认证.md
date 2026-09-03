Created by 侯忠林, last modified on 六月 14, 2024

  




-   [1. 总述](#C驱动支持UKEY满足双因子认证-1.总述)  
    -   [1.1需求分析](#C驱动支持UKEY满足双因子认证-1.1需求分析)  
-   [2. 功能列表](#C驱动支持UKEY满足双因子认证-2.功能列表)  
-   [3. 规格与约束](#C驱动支持UKEY满足双因子认证-3.规格与约束)  
-   [4. 特性](#C驱动支持UKEY满足双因子认证-4.特性)  
    -   [4.1整体设计](#C驱动支持UKEY满足双因子认证-4.1整体设计)  
        -   [协议兼容性](#C驱动支持UKEY满足双因子认证-协议兼容性)  
        -   [客户端登录](#C驱动支持UKEY满足双因子认证-客户端登录)  
        -   [服务端验证](#C驱动支持UKEY满足双因子认证-服务端验证)  
        -   [公钥密码的导出：](#C驱动支持UKEY满足双因子认证-公钥密码的导出：)  
-   [5.兼容性](#C驱动支持UKEY满足双因子认证-5.兼容性)  
-   [6.未来规划](#C驱动支持UKEY满足双因子认证-6.未来规划)  
-   [7.附录](#C驱动支持UKEY满足双因子认证-7.附录)  




#   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#1-%E6%80%BB%E8%BF%B0)  

需求：    [[YDBRD-24657] 登录协议改造，使之满足GB15843标准 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-24657)  

调研文档：    [数据加密相关配置 - 侯忠林 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150629558)  

接口规范：

ukey设备参照：GM/T 0016-2012 智能密码钥匙密码应用接口规范

加接密，签名验签接口参照：GM/T 0018-2012 密码设备应用接口规范

  [GMSSL - 国密SSL实验室](https://www.gmssl.cn/gmssl/index.jsp?go=down)  

用户登录，服务端对登录用户进行身份认证。yashan现阶段支持的认证方式包括：密码认证/OS认证。

- 密码：密码在客户端AES（key is generated from sha512)加密，服务端AES解出明文后进行认证。
- OS：依赖本地环境用户组。


为满足国密要求，需对密码认证方式的传输流程进行以下改造，OS不需要改造：

- 口令登录满足GB15843第二部分标准，支持对称加解密：    [GB T 15843.2-2017 信息技术　安全技术　实体鉴别　第2部分：采用对称加密算法的机制 - 道客巴巴 (doc88.com)](https://www.doc88.com/p-2826482869729.html)  
- UKEY登录满足GB15843第三部分标准，支持签名验签：    [GB-T 15843.3-2023信息技术 安全技术 实体鉴别 第3部分：采用数字签名技术的机制 - 道客巴巴 (doc88.com)](https://www.doc88.com/p-70859854920255.html)  


## 1.1需求分析

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|:---|:---|:---|:---|:---|:---|
|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|易用性|  
|----|否|是|----|
|可修改性|----|----|NA|不涉及|----|
|兼容性|----|----|NA|不涉及|----|
|可维可测|  
|  
|  
|  
|  
|
|功能|GB15843第二部分,  
|- SM4算法替换
- 新增满足  GB15843第二部分的专用加密串
|是|是|----|
||GB15843第三部分|- ukey 登录
- yaspwd 导出公钥
- 新增满足  GB15843第三部分的专用加密串
|是|是|----|
|安全|  
|----|NA|不涉及|----|
|周边配合|审计|----|NA|不涉及|----|
|性能|  
|  
|是|是|----|
|可用性|恢复场景|----|NA|不涉及|----|
|可靠性|故障场景|----|NA|不涉及|----|
|周边配合|权限|----|NA|不涉及|----|


#   [2. ](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)    功能列表

（1）    [GB-T 15843.3](https://www.doc88.com/p-70859854920255.html)       数字签名：采用分发ukey形式，非对称加密SM2。  在CMD_DIGEST中新增服务端随机数+固定SID+客户端随机数的对称加密串。

（2）    [GB T 15843.2](https://www.doc88.com/p-2826482869729.html)         [对称加密算法](https://www.doc88.com/p-2826482869729.html)     ：改成国密算法SM4。在CMD_DIGEST中新增服务端随机数+客户端随机数的对称加密串。

#   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

#   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  

## 4.1整体设计

**原始AES加密登录流程**

![](https://pingcode.yasdb.com/atlas/files/public/67396d2d8970c2af4f5210c5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFRQUFBQUFJQUFBQUJBQUJBQUFBQUFBQkFBQUFBQUFBQUFEQUFBQUFBQUFBQUFBQUFBQUFnQUFBQWdBQUFBQUFBQUJBQUFJQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFRQkFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUJBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDYzNzUsImV4cCI6MTc4MjMxNzE3NX0.Z9e-S8q5zQp_Y7GFZXXDTeGb6bamVOQj5wStK2Tla3g)

**新增的SM4已经UKEY签名的流程**  ：

  


![](https://pingcode.yasdb.com/atlas/files/public/67396d2d8970c2af4f5210c6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFRQUFBQUFJQUFBQUJBQUJBQUFBQUFBQkFBQUFBQUFBQUFEQUFBQUFBQUFBQUFBQUFBQUFnQUFBQWdBQUFBQUFBQUJBQUFJQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFRQkFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUJBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDYzNzUsImV4cCI6MTc4MjMxNzE3NX0.Z9e-S8q5zQp_Y7GFZXXDTeGb6bamVOQj5wStK2Tla3g)

### 协议兼容性

**ackLogin改动：**

原始协议字段

|encryVersion(uint32)||
|---|---|
|transEncryVersion(uint32)||
|saltLen(uint16)|secretKeyLen(uint16)|
|salt(saltLen*uint8)||
|secretKey(secretKeyLen*uint8)||


修改后：

|encryVersion(uint32)||||
|---|---|---|---|
|**transEncryVersion(uint32:8)**|**needUKey(uint32:1)**|**unused(uint32:23)**||
|saltLen(uint16)||secretKeyLen(uint16)||
|salt(saltLen*uint8)||||
|secretKey(secretKeyLen*uint8)||||


**将原来的32位的transEncryVersion拆分成三个字段，needUKey为当需要进行ukey验证是传回此标记。**

  


transEncryVersion新增值：

SYM_ENCRY_VERSION_AES = 1,    
  SYM_ENCRY_VERSION_PLAIN = 2,    
  **SYM_ENCRY_VERSION_SM4 = 3,**

新增类型

SYM_ENCRY_VERSION_SM4 = 3

新增数据库参数

PASSWORD_CRYPTO_METHOD ：控制数据库登录密码的加密方式，可选值AES，SM4。默认值AES，都需要依赖crypto的依赖库。

CLIENT_UKEY_AUTH：控制数据库登录是否使用ukey，可选值TRUE，FALSE。默认FALSE。需要依赖crypto库。

校验逻辑：

1. 如果transEncryVersion为SYM_ENCRY_VERSION_SM4 但是  **客户端版本为低版本报异常不支持**
1. 如果CLIENT_UKEY_AUTH为TRUE
1. 但是  **客户端版本为低版本报异常不支持**


secretKey：

- AES加密方式生成secretKey逻辑不变，为服务端随机数serverRandom为源数据，用户pwd和salt加上encryVersion通过哈希得到数据为key，进行加密得到secretKey。客户端拿到secretKey以后，通过pwd和salt加上encryVersion通过哈希得到数据为key。按照transEncryVersion的类型中加密算法进行解密，拿到服务端随机数serverRandom。
- SM4的加密secretKeys就是serverRandom的原始数据，不加密。


  


**reqDigest改动:**

digest: 

- AES加密的digest的生成逻辑也不变，通过pwd作为源数据，服务端随机数serverRandom作为key，进行加密生成。服务端通过服务端随机数serverRandom作为key将digest解密拿到pwd，然后验证pwd登录
- DES的加密digest的生成逻辑也不变，不过源数据是serverRandom，pwd和salt加上encryVersion通过哈希得到数据为key，服务端拿到加密数据解密对比serverRandom的原始数据。实现pwd的校验。pwd不在通过明文发送，只参与加密的过程。


  


**新增命令字CMD_SIGN**  ，和对应的请求reqSign

服务端在校验完reqDigest以后，需要验证UKEY则发送ackDigest，  **进行二次交互**  ，并带回一个serverRandom2为源数据。客户端拿到serverRandom2源数据后生成自己的clientRandom，按照下面结构进行签名

uKeySign：数据为国标中非对称加密    [GB-T 15843.3](https://www.doc88.com/p-70859854920255.html)     的要求，判断transEncryVersion中是否需要uKeySign，SID："10979831112SM2" + serverRandom2 + clientRandom+ serverID："YASDB"作为源数据，通过私钥签名得到签名数据，服务端通过公钥和签名数据还有源数据进行验证签名。

uKeySign源数据结构：

|SID(CodChar[32])|||
|:---:|---|---|
|serverRandom2(CodChar[32])|||
|clientRandom(CodChar[32])|||
|serverID(CodChar[32])|||


在签名完以后发送reqSign，将  clientRandom和签名数据一起发送给服务端，服务端验证。

|clientRandom(clientRandomLen + clientRandomLen*uint8)|
|---|
|uKeySign(uKeySignLen+ uKeySignLen*uint8)|


### 客户端登录

新增url连接参数UKEY_NAME UKEY_PIN，用于输入ukey的设备名和用户密码，用于ukey的登录。yasql例如yasql sys/Cod-2022@  192.168.10.31:1688  ?  UKEY_NAME=DBA&UKEY_PIN=12345678

客户端SM4的加密解密基于openssl库libcrypto，ukey的签名基于龙脉ukey_gm3000库。

客户端根据服务端ackLogin中返回的transEncryVersion数据

1. SYM_ENCRY_VERSION_AES则只通过AES加密password,生成digest模块数据
1. SYM_ENCRY_VERSION_SM4通过SM4加密serverRandom,pwd作为key，生成digest模块数据
1. 判断是否需要uKey验证，不需要则直接登录成功。
1. 需要ukey验证则解析ackDegist拿到serverRandom2数据，生成客户端随机数  clientRandom。
1. 加载ukey依赖
1. 如果ukey的设备名和用户密码没有值则报错，登录失败
1. 再先动态加载ukey所依赖的库文件
1. **初始化ukey设备，再同时存在多个ukey设备时,选择名称和UKEY_NAME 一致的设备连接，如果存在多个UKEY_NAME 一致的设备则抛出异常**
1. 打开YashanDB的app，验证用户密码，
1. 打开YashanDB的容器，使用私钥进行签名
1. 通过客户端随机数签名得到  uKeySign模块数据
1. 通过命令字CMD_SIGN发送  clientRandom和uKeySign数据给客户端，返回成功则登录成功。


### 服务端验证

服务端SM4的加密解密基于openssl库libcrypto，ukey的验证签名目前也是基于openssl库libcrypto。

服务端新增的有SM4的加密，解密。还有ukey的公钥文件加载，ukey的验签等逻辑。

新增数据库参数UKEY_DBA_PUBLIC_KEY_FILE UKEY_SECURITY_ADMIN_PUBLIC_KEY_FILE UKEY_AUDIT_ADMIN_PUBLIC_KEY_FILE三个参数来配置三种角色对应的公钥文件。默认放在YASDB_DATA/instance/目录下dba.pub，security_admin.pub，audit_admin.pub

### **公钥密码的导出：**

**命令：yaspwd ukey_role=DBA**

ukey_role只能取 DBA SECURITY_ADMIN AUDIT_ADMIN 分别代表DBA角色安全管理员和审计员三种角色

通过工具yaspwd将ukey中的公钥导出并保存在单独的文件中本地保存。限制文件的修改权限。

实现步骤：

1. 校验ukey_role的参数，拿到当前要导出公钥的角色
1. 列举本地机器连接的所有ukey
1. 客户端检测有多个uKey，直接报错，提示有多个ukey
1. 打开当前设备，并且设置当前设备的名称为ukey_role的参数，即当前用户的角色名
1. 打开名称为YashanDB的app，如果没有则提示用户输入设备认证码，admin的密码，用户密码，创建名称为YashanDB的app，并打开app
1. 如果已经存在YashanDB的app，在打开app后提示用户输入用户密码，验证登录用户
1. 打开名称为YashanDB的容器，如果没有则创建YashanDB的容器
1. 匹配密钥对，如果已经存在密钥对，则提示用户是否需要重新生成密钥对，如果需要，则重新生成密钥对
1. 导出公钥的结构数据
1. 将公钥数据转换成openssl的公钥数据结构，按照openssl的结构数据导出公钥文件
1. 如果生成了新的密钥对，则提示用户替换新的公钥文件
1. 提示用户公钥成功导出
1. 公钥文件导出在本地


  


# 5.兼容性

登录报文此时版本协商没有完成，不能靠conn_version控制版本。   采用AckLoginKey-》 transEncryVersion 控制。

- 传输类型为  SYM_ENCRY_VERSION_SM4  ：意味着使用SM4国密数据。  SYM_ENCRY_VERSION_SM4  此类型的auth中要完成serverRandom的校验，并且不再需要校验pwd，此模式不支持低版本
- ukey的认证也不支持低版本，ukey的认证完全独立于CMD_DEGIST。只通过配置参数PASSWORD_CRYPTO_METHOD 和用户角色判断是否需要验证ukey。


#   [6.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

# 7.附录

  [GB T 15843.2](https://www.doc88.com/p-2826482869729.html)     要求：

![](https://pingcode.yasdb.com/atlas/files/public/67396d2e8970c2af4f5210c7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFRQUFBQUFJQUFBQUJBQUJBQUFBQUFBQkFBQUFBQUFBQUFEQUFBQUFBQUFBQUFBQUFBQUFnQUFBQWdBQUFBQUFBQUJBQUFJQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFRQkFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUJBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDYzNzUsImV4cCI6MTc4MjMxNzE3NX0.Z9e-S8q5zQp_Y7GFZXXDTeGb6bamVOQj5wStK2Tla3g)

  [GB T 15843.3](https://www.doc88.com/p-2826482869729.html)     要求：

![](https://pingcode.yasdb.com/atlas/files/public/67396d2ea1ad9a3311dc8f36/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFRQUFBQUFJQUFBQUJBQUJBQUFBQUFBQkFBQUFBQUFBQUFEQUFBQUFBQUFBQUFBQUFBQUFnQUFBQWdBQUFBQUFBQUJBQUFJQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFRQkFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUJBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDYzNzUsImV4cCI6MTc4MjMxNzE3NX0.Z9e-S8q5zQp_Y7GFZXXDTeGb6bamVOQj5wStK2Tla3g)

## Attachments:

[image2024-4-2_19-22-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMmRhMWFkOWEzMzExZGM4ZjMyIiwicmVmX2lkIjoiNjczOTZkMmQ3MjgyMDZlZmI5MmYxYzA0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2Mzc0LCJleHAiOjE3ODIzOTI3NzR9.xonQhYwvcD1ZVWobbhjzlFJmyuHIG1YJt_KoAqOqfj4)

 (image/png)    


[image2024-4-2_19-12-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMmRhMWFkOWEzMzExZGM4ZjMzIiwicmVmX2lkIjoiNjczOTZkMmQ3MjgyMDZlZmI5MmYxYzA0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2Mzc0LCJleHAiOjE3ODIzOTI3NzR9._xLhnuhLRu2UIT6qHfoNIv9x69hdKB9nOtkDxvS1lMQ)

 (image/png)    


[GMT_0018-2012.pdf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMmRhMWFkOWEzMzExZGM4ZjM0IiwicmVmX2lkIjoiNjczOTZkMmQ3MjgyMDZlZmI5MmYxYzA0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2Mzc0LCJleHAiOjE3ODIzOTI3NzR9.VL7oHvSAZmh-omdwdFa3ZKaqUr9DkgCPkpOVGsDxsjs)

 (application/pdf)    


[GMT_0016-2012.pdf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMmQ4OTcwYzJhZjRmNTIxMGMzIiwicmVmX2lkIjoiNjczOTZkMmQ3MjgyMDZlZmI5MmYxYzA0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2Mzc0LCJleHAiOjE3ODIzOTI3NzR9.xJgdP4sOCvj1Wyra7Q5nPMcvN3u1yKimNcQC3AZfDFw)

 (application/pdf)    
