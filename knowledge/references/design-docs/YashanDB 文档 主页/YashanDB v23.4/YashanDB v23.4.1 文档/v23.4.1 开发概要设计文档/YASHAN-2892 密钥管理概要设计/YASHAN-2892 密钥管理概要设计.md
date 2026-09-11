Created by 陈宜顺, last modified on 十一月 15, 2024

  [YASHAN-2892 - 支持密钥管理](https://pingcode.yasdb.com/ship/ideas/665431455d57e18ea9d0f6cc)  

-   [1、总述](#id-密钥管理概要设计-1、总述)  
    -   [1.1 需求背景：](#id-密钥管理概要设计-1.1需求背景：)  
    -   [1.2 调研文档](#id-密钥管理概要设计-1.2调研文档)  
    -   [1.2.1 业界密钥管理调研](#id-密钥管理概要设计-1.2.1业界密钥管理调研)  
    -   [1.2.2 Oracle钱包方案](#id-密钥管理概要设计-1.2.2Oracle钱包方案)  
    -   [1.2.3 密钥管理方案对比](#id-密钥管理概要设计-1.2.3密钥管理方案对比)  
    -   [1.3 需求分析](#id-密钥管理概要设计-1.3需求分析)  
        -   [1.3.1 主要实现功能，分两个阶段](#id-密钥管理概要设计-1.3.1主要实现功能，分两个阶段)  
        -   [1.3.2 质量属性场景分析](#id-密钥管理概要设计-1.3.2质量属性场景分析)  
    -   [1.4 数据字典](#id-密钥管理概要设计-1.4数据字典)  
    -   [1.5 开源依赖](#id-密钥管理概要设计-1.5开源依赖)  
-   [2、接口](#id-密钥管理概要设计-2、接口)  
    -   [2.1 配置参数](#id-密钥管理概要设计-2.1配置参数)  
    -   [2.2 SQL语法](#id-密钥管理概要设计-2.2SQL语法)  
-   [3、规格与约束](#id-密钥管理概要设计-3、规格与约束)  
-   [4、特性](#id-密钥管理概要设计-4、特性)  
    -   [4.1 密钥钱包](#id-密钥管理概要设计-4.1密钥钱包)  
    -   [4.2 TDE表空间密钥管理](#id-密钥管理概要设计-4.2TDE表空间密钥管理)  
    -   [4.3 表密钥/列密钥管理](#id-密钥管理概要设计-4.3表密钥/列密钥管理)  
    -   [4.4 相关视图](#id-密钥管理概要设计-4.4相关视图)  
    -   [4.5 密钥管理权限](#id-密钥管理概要设计-4.5密钥管理权限)  
    -   [4.6 硬件指令加速](#id-密钥管理概要设计-4.6硬件指令加速)  
    -   [4.7 硬件加密模块](#id-密钥管理概要设计-4.7硬件加密模块)  
    -   [4.8 关键流程示例说明](#id-密钥管理概要设计-4.8关键流程示例说明)  
    -   [4.9 工作量评估](#id-密钥管理概要设计-4.9工作量评估)  
-   [5.未来规划](#id-密钥管理概要设计-5.未来规划)  




# 1、总述

### 1.1 需求背景：

1. 当前崖山数据库的TDE以及列加密使用了硬编码的密钥且无法修改，对于密钥泄漏后有泄密的风险。需要引入密钥管理的机制，以保证用户数据的安全性。
1.   [密钥相关的认证需求](https://pingcode.yasdb.com/wiki/pages/67399c1e593f99c9ff24a8b4)  驱动


### 1.2 调研文档

### 1.2.1     [业界密钥管理调研](https://conf.yasdb.com/pages/viewpage.action?pageId=171055418)  

### **1.2.2 Oracle钱包方案**

![](https://pingcode.yasdb.com/atlas/files/public/67396ef4a1ad9a3311dc9b20/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUJBQklBQUFBQWdBQUJBSUFDQUFBQUFBQUFBQUFBQUFBQUFBZ0NnUUFBQUFBQWdBQUFBQUFFQUFBQUFBQUFBQUFBQUFnSUFBQUVFQUFBQUFBQUFBQUJCRUFnQUVBQUFCQUFBZ0FBZ0FBQUVBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFrQUFBQUVBQUJBQUFBQUFBZ0lBQUFBQUFpQUFBQVJBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1ODYsImV4cCI6MTc4MjQ2NzM4Nn0.2ebmIVIHdxhDJe4Zo0HpzR231Cw0u_K_3KT9DK095wI)

方案要点：

- 两层密钥架构，主密钥（MEK）和数据密钥（DEK）
- MEK与DEK逻辑隔离，DEK在数据库中加密存储，MEK存放数据外部，可在本地文件系统或者远端
- 支持本地钱包管理（SQL+文件），本地外部管理（OKV、KMIP协议服务器、硬件加密机）及云端管理（OCI KMS）
- 提供密钥管理基础能力：密钥创建、轮转、备份、销毁、迁移等


### 1.2.3 密钥管理方案对比

各数据库厂商的密钥管理能力对比：

|  
|数据库厂商|是否支持本地钱包|主密钥可能的位置|外部密钥管理方式|是否支持KMIP|支持的KMS服务|KMS生态|其它补充说明|
|---|---|---|---|---|---|---|---|---|
|1|Oracle|√|- 钱包文件
- OKV
- 加密机
- KMS
|本地部署OKV及其它KMIP服务器、硬件加密机、KMS|√|OCI KMS|Oracle|  
|
|2|达梦|x|- 内置内存结构（黑盒）
|从公开资料里面没找到，猜测没有|x|不明确，猜测无|无|密钥由数据库  内部管理，用户  不可见|
|3|OceanBase|部分语法支持，实现不完全一致|- 内部表
- 外部BKMI系统
|KMS|x|不明确，猜测是阿里的KMS服务|阿里|通过Keystore服务管理，语法参考Oracle|
|4|TiDB|x|- 密钥（临时）文件
- KMS
|KMS|x|AWS、Google Cloud、Azure提供的KMS服务|微软、谷歌、亚马逊|密钥文件是明文存储的，存在泄漏风险|
|5|人大金仓|x|- 内置内存结构（黑盒）
- 加密机
- 加密卡
|加密机|x|不明确，猜测无|无|提供了自适应加密卡接口，需要用户手动适配API实现|
|6|GaussDB|x|- KMS
|KMS|x|华为数据加密服务DEW|华为|和华为云强绑定，需要开通DEW服务|
|7|MySQL|x|- 支持KMIP协议的服务
    -   [Oracle Key Vault](https://www.oracle.com/database/technologies/security/key-vault.html)  
    -   [Thales CipherTrust Manager](https://thalesdocs.com/ctp/ig/other/mysql/index.html)  
    -   [Fornetix VaultCore](https://www.fornetix.com/solutions/vaultcore/)  
    -   [Townsend Alliance Key Manager](https://www.townsendsecurity.com/product/encryption-key-management-mysql)  
    -   [Entrust KeyControl](https://www.entrust.com/-/media/documentation/integration-guides/oracle-mysql-enterprise-keycontrol-nshield-ig.pdf)  
- KMS
|本地部署OKV及其它KMIP服务器、KMS|√|OCI KMS,Hashicorp Vault,AWS KMS|Oracle、亚马逊、HashiCorp|支持KMIP协议|
|8|PostgreSQL|x|- 密钥文件（猜测？）
- KMS
|KMS|x|各厂商自行提供的PostgresSQL服务有单独的适配|各厂商自己的生态|开源数据，各厂商有自己的方案,原话是：“  每次都是通过外部获取，例如 KMS”|
|9|SQL Server|x|- 内置内存结构（黑盒）
- Azure Key Vault
|KMS|x|- Azure Key Vault
- KMS
|微软|  
|
|10|YashanDB|x|- 内置内存结构（黑盒）
|无|x|不支持|无|  
|


- 标记为“不明确”的表示当前已检索公开资料中未找到相关资料
- 支持KMPI协议的解决方案：
    -   [Oracle Key Vault](https://www.oracle.com/database/technologies/security/key-vault.html)  
    -   [Thales CipherTrust Manager](https://thalesdocs.com/ctp/ig/other/mysql/index.html)  
    -   [Fornetix VaultCore](https://www.fornetix.com/solutions/vaultcore/)  
    -   [Townsend Alliance Key Manager](https://www.townsendsecurity.com/product/encryption-key-management-mysql)  
    -   [Entrust KeyControl](https://www.entrust.com/-/media/documentation/integration-guides/oracle-mysql-enterprise-keycontrol-nshield-ig.pdf)  


  


各KMS厂商对密钥管理能力的支持情况：

|  
|KMS服务厂商|KMS服务名称|对接形式|是否支持KMIP|其它通用协议支持|
|---|---|---|---|---|---|
|1|Oracle|Oracle Cloud Infrastructure（OCI）|私有API，需单独适配|不明确|不明确|
|2|AWS|AWS KMS|私有API，需单独适配,AWS KMS API|x|x|
|3|阿里|阿里云KMS|私有API，需单独适配|x|x|
|4|华为|DEW|私有API，需单独适配|x|x|
|5|微软|不明确，不过有Azure Key Vault|私有API，需单独适配|x|x|
|6|腾讯|腾讯KMS|私有API，需单独适配|x|x|


- KMS的支持程度各厂商都存在差异
- 需要单独适配


### 1.3 需求分析

#### 1.3.1 主要实现功能，分两个阶段

基础能力构筑阶段：（从0->1，构建基本能力）

- 构建keystore服务，用来存储、管理密钥并提供密钥服务。
- 采用多级密钥体系，  包括主密钥（MEK）和数据加密密钥（DEK）。
- TDE及列加密使用DEK进行加密


完善阶段：（从1->100，构建完善能力）

- 提供密钥更新功能，并能保证密钥的一致性和完整性。
- 提供密钥备份功能，保证系统的高可用功能。
- 提供密钥操作审计功能，保证密钥的安全性。
- 提供密钥库切换功能，用来切换keystore。
- 密钥权限管理（SYSKM、ADMINISTER KEY MANAGEMENT）
- 提供硬件加密能力，加速性能
- 提供外部密钥管理工具，如YASPKI，进行密钥的维护
- 不同部署形态下的密钥管理
    - 集群下的密钥管理
    - 分布式下的密钥管理


#### **1.3.2 质量属性场景分析**

|  
|属性|场景名称|实现要点|关键技术点|特性是否涉及|SR|
|:---|:---|:---|:---|:---|:---|:---|
|1|功能性|支持钱包基本功能|- 支持操作和解析pkcs#12格式文件
- 支持钱包基本SQL语法功能，包括创建钱包，打开/关闭钱包
- 支持在钱包中创建/修改TDE主密钥MEK
|是|是|  
|
|2|功能性|TDE表空间对接钱包基本功能|- 支持创建TDE表空间时生成数据密钥DEK，并使用MEK加密存储
- TDE表空间使用DEK进行数据加密/解密
|是|是|  
|
|3|功能性|表加密和列加密对接钱包基本功能|- 表加密和列加密时使用DEK进行加密/解密
|是|是|  
|
|4|功能性|密钥维护操作|- 密钥更新/轮换等功能
|是|是|  
|
|5|功能性|钱包功能适配集群|- 需要支持集群形态下的密钥管理
|是|是|  
|
|6|功能性|钱包功能适配分布式|- 需要支持分布式形态下的密钥管理
|是|是|  
|
|7|性能|开启加密能力后的数据库性能波动在可接受范围内|- MEK在本地/远端管理时的性能，需要验证
- 加密算法权衡性能和安全性
- 参考TPCC场景
|是|是|----|
|8|性能|硬件加密能力|- 支持  AES-NI指令
|是|是|  
|
|9|可用性|密钥文件损坏后的恢复|- 支持密钥文件恢复（本地/远端）
- 密钥文件恢复需要在秒级（分钟级）完成
- 自动检测故障及恢复
|是|是|----|
|10|可靠性|密钥文件损坏|- 需要支持备份密钥文件
- 考虑支持定时备份、人工备份
- 本地备份/远端备份
- 备份密钥的安全性，需要加密
- 密钥文件的校验机制
|是|是|----|
|11|可维可测|查看密钥相关信息的视图能力|- v$encryption_wallet
- v$encryption_keys
|是|是|----|
|12|可维可测|密钥维护工具|- yaspki
|是|是|  
|
|13|安全性|密钥操作的权限管理|两种权限管理：,- SYSKM administrative privilege
- ADMINISTER KEY MANAGEMENT system privilege.
|是|是|----|
|14|易用性|修改、维护密钥的能力|- 对标Oracle语法，降低学习成本
- 一个熟悉Oracle的用户应该在xx时间内上手
|是|是|----|
|15|易用性|免密码登录的能力|- 钱包管理中对sso文件的支持
|是|是|  
|
|16|可修改性|支持扩展密钥存储|接口对接工作控制在2人周以内：,- 对接OKV及其它KMIP协议服务端
- 对接各云厂商的KMS服务
- 对接硬件加密机、PCIE密码卡等硬件设备
|是|是|----|
|17|兼容性|不影响已发布版本创建的TDE表空间升级后的访问|- 考虑升级场景做转换
|是|是|----|
|18|周边配合|审计|- 密钥审计功能
|是|是|----|
|19|周边配合|导入导出工具|- 导入导出密钥能力，可结合yaspki或者wallet语法
|是|是|----|


### **1.4 数据字典**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|DEK|DEK（Data Encryption Key）是用于直接加密数据的密钥。|是|Oracle|
|MEK|MEK（Master Encryption Key）是用于加密数据密钥的密钥。|是|Oracle|
|Wallet|钱包管理，提供了一种简单的方式来进行数据库密钥的外部管理，从而提高安全性。|是|Oracle|
|Keystore|表示密钥管理模块，它可以是本地自研软件密钥库YKS、物理接入设备密码卡、外部KMS系统，由数据库起库的时候指定。|是|Oracle|
|PCIE|密码卡|是|NA|
|SDF|SDF（Secure Device Format）是一种安全接口标准。SDF可以用于执行各种密码学操作，包括密钥管理、加密、解密、数字签名和身份认证等。|是|NA|
|PKCS#12|PKCS#12是一种交换数字证书的加密标准，用来描述个人身份信息。如：用户公钥、私钥、证书等。|是|  
|
|PKCS#11|PKCS#11标准定义了与密码令牌（如硬件安全模块（HSM）和智能卡）的独立于平台的API|是|  
|
|KMIP协议|密钥管理互操作性协议 (KeyManagement InteroperabilityProtocol, KMIP)，用于存储和维护密钥、证书和秘密对象的客户机/服务器通信协议。|是|  
|
|KMS|密钥管理服务（KMS）是一套密钥管理系统， 可以针对云上数据/各端上的加密需求精心设计的密码应用服务|是|  
|
|YKS|YKS（yashan key store）本地自研软件密钥服务|否|NA|


### **1.5 开源依赖**

可能引入的开源依赖：

|  
|开源库|用途|来源|备注|
|---|---|---|---|---|
|1|KMIP协议库|对接外部存储获取MEK|  
|  
|
|2|PKCS#11|钱包文件读写|  
|  
|
|3|PKCS#12|钱包文件读写|  
|  
|
|4|  
|密码卡|  
|  [接入密码卡](https://conf.yasdb.com/pages/viewpage.action?pageId=104228955)  |


  


# 2、接口

### 2.1 配置参数

|  
|配置项|配置项描述|生效时机|取值范围|默认值|
|---|---|---|---|---|---|
|1|KEYSTORE_ROOT|设置钱包路径|重启生效|路径字符串|可为空|
|2|KEYSTORE_CONFIGURATION|设置TDE的密钥获取方式|重启生效、立即生效|FILE、OKV等，暂时先仅支持FILE|可为空|


### **2.2 SQL语法**

- administer key management


# 3、规格与约束

1、二级密钥体系。

2、使用密钥钱包机制，主密钥及数据加密密钥在使用时按需生成。

3、钱包机制支持TDE、表加密、列加密。

4、通过内部机制（系统表或数据文件）管理DEK，通过外部钱包或远程机制管理MEK

5、密钥数量上限xxx（待确认）。

6、支持形态：单机、集群、分布式。

  


# 4、特性

架构图：

![image.png](https://pingcode.yasdb.com/atlas/files/public/686b2cd8aab75fc0aeb2eff9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUJBQklBQUFBQWdBQUJBSUFDQUFBQUFBQUFBQUFBQUFBQUFBZ0NnUUFBQUFBQWdBQUFBQUFFQUFBQUFBQUFBQUFBQUFnSUFBQUVFQUFBQUFBQUFBQUJCRUFnQUVBQUFCQUFBZ0FBZ0FBQUVBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFrQUFBQUVBQUJBQUFBQUFBZ0lBQUFBQUFpQUFBQVJBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1ODYsImV4cCI6MTc4MjQ2NzM4Nn0.2ebmIVIHdxhDJe4Zo0HpzR231Cw0u_K_3KT9DK095wI)

  


- 应用层：具体的加密特性，加/解密接口的调用者，负责提供待加密的数据或者对解密的数据进行处理。
- 接口层：对加密操作进行了接口封装，提供统一的加解密接口，以及使能接口如初始化、配置设置等，还有硬件加速接口用于支持特定CPU硬件加密指令的加速。
- 缓存层：缓存密钥的内存结构，包含三级密钥体系的密钥缓存机制：一级密钥MEK，二级密钥GEK以及三级密钥DEK、通信密钥等，用于加速对密钥的访问速度
- 密钥管理接口：用于提供用户操作与交互密钥的接口，包含密钥创建、密钥修改、权限控制等能力。
- 密钥协议层：用于封装PKCS#11的接口，所有密钥管理的相关操作，统一通过该接口进行。
- 本地管理层：用于封装PKCS#12的接口，用于存储本地密钥文件。该层实现了PKCS#11的接口，并通过PKCS#12文件完成密钥存储和访问的相关能力。
- 远程管理层：用于对接HSM以及KMS等远程密钥管理模块，PKCS#11接口可以直接对接HSM模块，实现对密钥管理的操作，也可以通过本地管理层对KMS访问的封装，实现对密钥的远程访问和操作。


### 4.1 密钥钱包

业界有多种密钥管理的方式，如Oracle采用密钥钱包（Oracle Wallet），Oceanbase采用KMS+Wallet方式，SQL-Server采用加密密钥存放在控制文件或者EKM方式。

这里主要探讨采用Wallet方式进行密钥管理的方案。Wallet主要是读写PKCS#12以及sso文件，前者用于存储主密钥，后者为口令文件，用于免密码登录。

密钥钱包的内容示例：

```
// ewallet为固定前缀，后面跟了时间戳的为历史钱包
wallet-root/eus/ewallet.p12
wallet-root/tde/ewallet.p12
wallet-root/tde/ewallet_2016120918333644.p12
wallet-root/tde_seps/cwallet.sso
wallet-root/tls/ewallet.p12
wallet-root/xdb_wallet/ewallet.p12
wallet-root/3FD1C95B48205D0FE053C5A0E40AEF8C/tde/ewallet.p12
wallet-root/3FD1C95B48205D0FE053C5A0E40AEF8C/tde/ewallet_2016110918331622.p12
wallet-root/3FD1C95B48205D0FE053C5A0E40AEF8C/tde/ewallet_2016110918332363.p12
wallet-root/3FD1C95B48205D0FE053C5A0E40AEF8C/tde_seps/cwallet.sso
wallet-root/3FD1C95B48205D0FE053C5A0E40AEF8C/tls/cwallet.sso
wallet-root/3FD1C95B48205D0FE053C5A0E40AEF8C/tls/ewallet.p12
```

![](https://pingcode.yasdb.com/atlas/files/public/67396ef48970c2af4f521cb1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUJBQklBQUFBQWdBQUJBSUFDQUFBQUFBQUFBQUFBQUFBQUFBZ0NnUUFBQUFBQWdBQUFBQUFFQUFBQUFBQUFBQUFBQUFnSUFBQUVFQUFBQUFBQUFBQUJCRUFnQUVBQUFCQUFBZ0FBZ0FBQUVBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFrQUFBQUVBQUJBQUFBQUFBZ0lBQUFBQUFpQUFBQVJBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1ODYsImV4cCI6MTc4MjQ2NzM4Nn0.2ebmIVIHdxhDJe4Zo0HpzR231Cw0u_K_3KT9DK095wI)

WALLET_ROOT   值可以包含对环境变量的引用

钱包特点：

- 只涉及两种文件p12、sso
- 统一命名：ewallet、cwallet
- 按模块分目录存放，每个模块单独一个目录


**PKCS#12文件**  ：

![](https://conf.yasdb.com/download/attachments/104234094/image2024-9-12_15-5-45.png?version=1&modificationDate=1726124746000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUJBQklBQUFBQWdBQUJBSUFDQUFBQUFBQUFBQUFBQUFBQUFBZ0NnUUFBQUFBQWdBQUFBQUFFQUFBQUFBQUFBQUFBQUFnSUFBQUVFQUFBQUFBQUFBQUJCRUFnQUVBQUFCQUFBZ0FBZ0FBQUVBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFrQUFBQUVBQUJBQUFBQUFBZ0lBQUFBQUFpQUFBQVJBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1ODYsImV4cCI6MTc4MjQ2NzM4Nn0.2ebmIVIHdxhDJe4Zo0HpzR231Cw0u_K_3KT9DK095wI)

相关API：

```
// 写入形式：
    X509* cert = NULL;
    CodChar* infile = "/data/cys/pkcs12/yashan.pem";// 主密钥，可以通过openssl的接口生成
    fp = fopen(infile, "r");
    EVP_PKEY* pkey = (EVP_PKEY*)anrGetSSLCbSet()->PEM_read_PrivateKey(fp, NULL, NULL, NULL);
    fclose(fp);
    PKCS12* p12 = (PKCS12*)anrGetSSLCbSet()->PKCS12_create(password, name, pkey, cert, NULL, 0, 0, 0, 0, 0);
    COD_ASSERT(p12 != NULL);

// 读取形式：
    FILE *fp = fopen("/data/cys/pkcs12/yashan.p12", "rb");
    PKCS12* p12 = cbSet->d2i_PKCS12_fp(fp, NULL);
    COD_ASSERT(p12 != NULL);
    fclose(fp);

    CodBool isParse = cbSet->PKCS12_parse(p12, password, &pkey, &cert, NULL);
    COD_ASSERT(isParse);

// 加密方式：
    ANI_EVP_PKEY_CTX ctx = gCbSet.EVP_PKEY_CTX_new(pkey, NULL);
    gCbSet.EVP_PKEY_encrypt_init(ctx);
    gCbSet.EVP_PKEY_ENCRYPT(ctx, (CodUchar*)encryptDigest, encryptSize, (CodUchar*)rawDigest, rawSize);

// 解密方式：
    ANI_EVP_PKEY_CTX ctx = gCbSet.EVP_PKEY_CTX_new(pkey, NULL);
    gCbSet.EVP_PKEY_encrypt_init(ctx);
    gCbSet.EVP_PKEY_decrypt(ctx, (CodUchar*)rawDigest, rawSize, (CodUchar*)encryptDigest, encryptSize);
```

  


**口令文件**

口令文件用于保存keystore的登录口令。

口令文件yks.sso头部保存了PKCS12文件的加密口令的密文和它的解密密钥等元信息，并把该头部进行混淆。然后把口令保护的  **密钥文件**  （即PKCS12文件）附在文件尾部。

sso文件格式：

![](https://pingcode.yasdb.com/atlas/files/public/67396ef4a1ad9a3311dc9b23/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUJBQklBQUFBQWdBQUJBSUFDQUFBQUFBQUFBQUFBQUFBQUFBZ0NnUUFBQUFBQWdBQUFBQUFFQUFBQUFBQUFBQUFBQUFnSUFBQUVFQUFBQUFBQUFBQUJCRUFnQUVBQUFCQUFBZ0FBZ0FBQUVBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFrQUFBQUVBQUJBQUFBQUFBZ0lBQUFBQUFpQUFBQVJBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1ODYsImV4cCI6MTc4MjQ2NzM4Nn0.2ebmIVIHdxhDJe4Zo0HpzR231Cw0u_K_3KT9DK095wI)

![](https://conf.yasdb.com/download/attachments/104234094/image2024-9-12_15-4-29.png?version=1&modificationDate=1726124670000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUJBQklBQUFBQWdBQUJBSUFDQUFBQUFBQUFBQUFBQUFBQUFBZ0NnUUFBQUFBQWdBQUFBQUFFQUFBQUFBQUFBQUFBQUFnSUFBQUVFQUFBQUFBQUFBQUJCRUFnQUVBQUFCQUFBZ0FBZ0FBQUVBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFrQUFBQUVBQUJBQUFBQUFBZ0lBQUFBQUFpQUFBQVJBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1ODYsImV4cCI6MTc4MjQ2NzM4Nn0.2ebmIVIHdxhDJe4Zo0HpzR231Cw0u_K_3KT9DK095wI)

可参照这头部形式提供数据结构。

免密登录方式具体形式待调研。

  


  `WALLET_ROOT`       值可以包含对环境变量的引用

### 4.2 TDE表空间密钥管理

**创建加密表空间**

1. 打开TDE钱包，解出TDE的主密钥MEK（KEK）
1. 生成随机数，并把随机数作为TDE表空间密钥，使用MEK加密
1. 为了防止碰撞攻击，需要同时生成一个随机整数作为初始向量（IV）
1. 把加密后的密钥密文以及IV明文存储在ctrl文件以及dataFile的头部


**DC加载**

1. dc加载时，校验ctrl文件和dataFile头部的密钥密文，校验通过后缓存到dc上
1. 缓存初始向量IV，初始化向量用于让相同的密钥文本产生不同的密文。


![](https://pingcode.yasdb.com/atlas/files/public/67396ef48970c2af4f521cb2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUJBQklBQUFBQWdBQUJBSUFDQUFBQUFBQUFBQUFBQUFBQUFBZ0NnUUFBQUFBQWdBQUFBQUFFQUFBQUFBQUFBQUFBQUFnSUFBQUVFQUFBQUFBQUFBQUJCRUFnQUVBQUFCQUFBZ0FBZ0FBQUVBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFrQUFBQUVBQUJBQUFBQUFBZ0lBQUFBQUFpQUFBQVJBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1ODYsImV4cCI6MTc4MjQ2NzM4Nn0.2ebmIVIHdxhDJe4Zo0HpzR231Cw0u_K_3KT9DK095wI)

修改加密表空间

 暂不涉及

删除加密表空间

 暂不涉及

**加密表空间写入数据：**

1. 准备好要写的Block数据块
1. 从dc读取TDE表空间密钥密文，并通过MEK解密出密钥明文
1. 通过密钥明文+IV对Block加密
1. 写入加密后的Block数据块


**加密表空间读取数据：**

1. 准备好要读取的Block数据块密文
1. 从dc读取TDE表空间密钥密文，并通过MEK解密出密钥明文
1. 通过密钥明文+IV对Block解密
1. 返回解密后的Block数据块


![](https://pingcode.yasdb.com/atlas/files/public/67396ef48970c2af4f521cb3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUJBQklBQUFBQWdBQUJBSUFDQUFBQUFBQUFBQUFBQUFBQUFBZ0NnUUFBQUFBQWdBQUFBQUFFQUFBQUFBQUFBQUFBQUFnSUFBQUVFQUFBQUFBQUFBQUJCRUFnQUVBQUFCQUFBZ0FBZ0FBQUVBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFrQUFBQUVBQUJBQUFBQUFBZ0lBQUFBQUFpQUFBQVJBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1ODYsImV4cCI6MTc4MjQ2NzM4Nn0.2ebmIVIHdxhDJe4Zo0HpzR231Cw0u_K_3KT9DK095wI)

### 4.3 表密钥/列密钥管理

参照加密表空间数据写入方式

  


### 4.4 相关视图

v$encryption_wallet

v$encryption_keys

### 4.5 密钥管理权限

密钥管理需要

- SYSKM administrative privilege
- ADMINISTER KEY MANAGEMENT system privilege.


由于鉴权有可能发生在DC加载前，鉴权过程需要结合密码文件进行（方案暂不明确，待调研）。

### 4.6 硬件指令加速

利用支持 AES-NI（一组高级加密标准新指令）的 Intel® CPU 提供用于 TDE 表空间加密的硬件加密加速。（待调研）

查看是否支持：

cat /proc/cpuinfo | grep aes

### 4.7 硬件加密模块

密钥保险库  KeyVault，  使用外部安全模块将普通的程序功能与加密操作分离开来，从而可以为数据库管理员和安全管理员分配单独的、不同的职责。安全性得到了增强，因为数据库管理员可能不知道密钥库密码，因此需要安全管理员提供密码。

参考Oracle密钥保险库（OKV），Oracle Database Vault 可在 Oracle Database 中实施数据安全性控制，确保仅特权用户访问应用数据，进而有效降低内外部威胁风险，满足职责分离等合规要求。

  [数据安全性 | Oracle Database Vault | Oracle 中国](https://www.oracle.com/cn/security/database-security/database-vault/)  

![](https://pingcode.yasdb.com/atlas/files/public/67396ef4a1ad9a3311dc9b24/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUJBQklBQUFBQWdBQUJBSUFDQUFBQUFBQUFBQUFBQUFBQUFBZ0NnUUFBQUFBQWdBQUFBQUFFQUFBQUFBQUFBQUFBQUFnSUFBQUVFQUFBQUFBQUFBQUJCRUFnQUVBQUFCQUFBZ0FBZ0FBQUVBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFrQUFBQUVBQUJBQUFBQUFBZ0lBQUFBQUFpQUFBQVJBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1ODYsImV4cCI6MTc4MjQ2NzM4Nn0.2ebmIVIHdxhDJe4Zo0HpzR231Cw0u_K_3KT9DK095wI)

### 4.8 关键  流程示例说明

|  
|操作描述|涉及语句|内部实现方案|备注|
|---|---|---|---|---|
|1|创建钱包的存储路径|sudo mkdir -vp ${WALLET_DIR}|调用文件系统命令|  
|
|2|设置钱包路径|alter system set wallet_root = '${WALLET_DIR}' scope= spfile;|增加配置项，设置数据库配置参数，需要重启生效|  
|
|3|设置  TDE_CONFIGURATION|alter system set tde_configuration = "keystore_configuration=FILE" scope=BOTH;|增加配置项，设置数据库配置参数，支持在线生效。,需要为keystore_configuration预留其它方式，如OKV、HSM等|value ::={    
  FILE |    
  OKV |    
  HSM |    
  FILE|OKV |    
  FILE|HSM |    
  OKV|FILE |    
  HSM|FILE},  
|
|4|创建密钥钱包|administer key management create keystore identified by ${DBUSR_PWD};|调用SSL的接口PKCS12_create创建pkcs12文件，|  
|
|5|设置密钥钱包免密登录（可选）|administer key management add secret '${DBUSR_PWD}' for client   'TDE_WALLET'   to local auto_login keystore '${SEPS_WALLET_DIR}';,administer key management set keystore open identified by EXTERNAL STORE container=all;|  
|此时没有任何主密钥,![](https://pingcode.yasdb.com/atlas/files/public/67396ef4a1ad9a3311dc9b25/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUJBQklBQUFBQWdBQUJBSUFDQUFBQUFBQUFBQUFBQUFBQUFBZ0NnUUFBQUFBQWdBQUFBQUFFQUFBQUFBQUFBQUFBQUFnSUFBQUVFQUFBQUFBQUFBQUJCRUFnQUVBQUFCQUFBZ0FBZ0FBQUVBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFrQUFBQUVBQUJBQUFBQUFBZ0lBQUFBQUFpQUFBQVJBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1ODYsImV4cCI6MTc4MjQ2NzM4Nn0.2ebmIVIHdxhDJe4Zo0HpzR231Cw0u_K_3KT9DK095wI),生成存放免密登录的sso文件|
|6|创建主密钥（MEK, 安全领域称为KEK）|ADMINISTER KEY MANAGEMENT SET KEY USING TAG 'CDB1: Initial Master Key' IDENTIFIED BY EXTERNAL STORE WITH BACKUP container=current;|  
|  
|
|7|创建自动登录钱包|a  dminister key management create auto_login keystore from keystore '${WALLET_DIR}/tde' identified by ${DBUSR_PWD};|  
|在tde/下生成一个cwallet.sso文件|
|8|创建TDE表空间|CREATE TABLESPACE xxx|1. 自动打开TDE钱包，解出TDE的主密钥MEK（KEK）
1. 生成随机数，并把随机数作为TDE表空间密钥，使用MEK加密
1. 把加密后的密钥存储在ctrl文件以及dataFile的头部。为了加速访问，可以在dc里面缓存一份（原因待确认，可能用于校验）
|alter system set "_tablespace_encryption_default_algorithm" = 'AES256' scope = both;,alter system set encrypt_new_tablespaces = 'ALWAYS' scope=both;,alter system set tablespace_encryption = 'AUTO_ENABLE' scope=spfile;,属于TDE表空间能力增强，需要看下这几个配置项是否需要一起支持|
|9|更换主密钥|ADMINISTER KEY MANAGEMENT SET KEY USING TAG '${TAG_DATA}' FORCE KEYSTORE IDENTIFIED BY EXTERNAL STORE WITH BACKUP container=current;|  
|激活时间最新的那个为当前使用的主密钥|


  


### 4.9 工作量评估

|  
|工作项|简要描述|优先级|工作量(单位: 人/周)|备注|
|:---|:---|---|---|:---|---|
|1|支持钱包基本功能|- 支持操作和解析pkcs#12格式文件
- 支持钱包基本SQL语法功能，包括创建钱包，打开/关闭钱包
- 支持在钱包中创建/修改TDE主密钥MEK
|高|4|  
|
|2|TDE表空间对接钱包基本功能|- 支持创建TDE表空间时生成数据密钥DEK，并使用MEK加密存储
- TDE表空间使用DEK进行数据加密/解密
|高|2|  
|
|3|表加密和列加密对接钱包基本功能|- 表加密和列加密时使用DEK进行加密/解密
|高|1|  
|
|4|密钥权限管理|两种权限管理：,- SYSKM administrative privilege
- ADMINISTER KEY MANAGEMENT system privilege.
|高|1|  
|
|5|密钥的视图能力|  
|高|1|  
|
|6|密钥备份/恢复功能|- 适配备份恢复能力，备份集要能找到对应的密钥
- 密钥自己要有备份能力
|高|2|  
|
|7|密钥更新/轮换功能|  
|高|2|  
|
|8|密钥审计功能|  
|高|2|  
|
|9|升级场景|- 升级时把老的秘钥写到表空间里面
|高|2|  
|
|10|提供硬件加密能力，加速性能|支持  AES-NI指令|中|2|  
|
|11|支持免密钥登录|- 支持解析sso格式文件
|高|2|  
|
|12|支持外部密钥管理工具，类似orapki|  
|中|2|  
|
|13|钱包功能适配集群|  
|高|2|  
|
|14|钱包功能适配分布式|  
|中|待定|  
|
|15|支持对接密钥保险库、KMS等第三方密钥管理服务|  
|低|2|  
|
|16|支持密码卡|认证需求：,- 主密钥通过密码卡加密
|？|？|用于应对检查，需要评估工作量。|


高优先级：21人周，约4人月

#   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

1. 对接加密机的能力
1. 对接各KMS厂商的能力
1. 提供崖山自己的KMS服务
1. 安全能力增强：多级密钥管理的支持


  


  


  


  


  


  


  


  


  


## Attachments:

[image2024-10-30_9-52-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZjM4OTcwYzJhZjRmNTIxY2E2IiwicmVmX2lkIjoiNjczOTZlZjM1OTNmOTljOWZmMjM4YjU4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NTg2LCJleHAiOjE3ODI1NDI5ODZ9.wlxpJQPiTIaM1pYyMUGlx9jDk4WL_xf_byfx_n6ez0I)

 (image/png)    


[image2024-11-5_17-47-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZjM4OTcwYzJhZjRmNTIxY2E3IiwicmVmX2lkIjoiNjczOTZlZjM1OTNmOTljOWZmMjM4YjU4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NTg2LCJleHAiOjE3ODI1NDI5ODZ9.7uOqEymelzmsK8mmIiEW-4BNhHlPKK2wEbREDvLQWDg)

 (image/png)    


[image2024-11-11_21-28-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZjQ4OTcwYzJhZjRmNTIxY2FjIiwicmVmX2lkIjoiNjczOTZlZjM1OTNmOTljOWZmMjM4YjU4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NTg2LCJleHAiOjE3ODI1NDI5ODZ9.m5Bo7G1Mrn0lmn-_CccdEWM8mf5c0wy4wnozulMjqEw)

 (image/png)    


[image2024-11-11_21-30-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZjRhMWFkOWEzMzExZGM5YjFlIiwicmVmX2lkIjoiNjczOTZlZjM1OTNmOTljOWZmMjM4YjU4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NTg2LCJleHAiOjE3ODI1NDI5ODZ9.we_ugRNgMNGDUWwTFtcdcFnfjDNYUEerpyu1edh9Jpc)

 (image/png)    


[image2024-11-11_21-32-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZjQ4OTcwYzJhZjRmNTIxY2FkIiwicmVmX2lkIjoiNjczOTZlZjM1OTNmOTljOWZmMjM4YjU4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NTg2LCJleHAiOjE3ODI1NDI5ODZ9.0SGaC0PG8M7zVQvmbu_C-FIhAKs7XFMqgVnjoLBert4)

 (image/png)    


[image2024-11-12_15-26-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZjQ4OTcwYzJhZjRmNTIxY2FlIiwicmVmX2lkIjoiNjczOTZlZjM1OTNmOTljOWZmMjM4YjU4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NTg2LCJleHAiOjE3ODI1NDI5ODZ9.ZC87iM56IJOUR859qzeQO0iMF4eNKE30D_VHhDRnCDk)

 (image/png)    


## Comments:

|  [](null)  ,> ,调研一下看下能否不传fp  Posted by chenyishun at 十一月 15, 2024 14:57|
|---|
|  [](null)  ,1. 是否需要同步秘钥文件？如何同步，是否有其他手段，如工具等
1. 表空间秘钥存到表空间头，列和表秘钥存到（参考Oracle的）系统表里面。已有enc$
1. 强调秘钥文件的备份，在资料里面做实施说明
1. SSO文件自己实现，不用对标oracle
1. 要考虑单机主备和集群的能力
,Posted by chenyishun at 十一月 15, 2024 15:01|


