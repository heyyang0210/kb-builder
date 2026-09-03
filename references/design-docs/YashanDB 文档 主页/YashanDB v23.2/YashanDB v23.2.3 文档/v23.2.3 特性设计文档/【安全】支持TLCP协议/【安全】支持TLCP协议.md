Created by 程康, last modified on 十月 15, 2024

23.0 IR          [[YDBRD-16668] 【安全】通信加密支持TLCP协议 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-16668)  

master IR      [[YDBRD-24660] 通信加密算法兼容TLCP和TLS - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-24660)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#1-overview%E6%A6%82%E8%BF%B0)  

支持  GMTLS（也叫TLCP）  国密协议。TLS/TLCP两者主要有以下区别

|区别|国标TLCP|国际TLS|细节|
|---|---|---|---|
|  
|1） 协议的版本号不同，握手和加密协议细节不同；|  
|  
|
|  
|2） 算法不同,SM2(  公钥密码算法),SM3(  密码摘要算法  ),SM4(  分组密码算法  ))|TLS采用的国际密码算,RSA,DES,SHA|SM2 -- RSA,SM3 --  DES,SM4 – SHA|
|  
|3） 采用的是SM2双证书体系。,CA,CA–加密证书 用于会话密钥生成,CA–签名证书 用于身份验证。（私钥加密，公钥解密）|一个证书参与到 身份验证和主会话密钥的生成|  
|


##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

支持范围：

- HA内部链路间
    - 主备
- C/S
    - **C驱动/YaShan --首先支持**
    - JDBC/YaShan


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#3-interfaces%E6%8E%A5%E5%8F%A3)  

### TLCP库选型

库仍以二进制形式，采用CPM管理，同yashanDB一起打包，不依赖源码。

库对比：主要有GmSSL和Tongsuo，达梦用的GmSSL（    [DM 物理存储结构 | 达梦技术文档 (dameng.com)](https://eco.dameng.com/document/dm/zh-cn/pm/physical-storage)    ）。开源协议均为Apache License 2.0。

|开发语言 |库|说明|开源协议|支持平台|
|---|---|---|---|---|
|c|GmSSL,  [GmSSL/LICENSE at master · guanzhi/GmSSL · GitHub](https://github.com/guanzhi/GmSSL/blob/master/LICENSE)  |北京大学自主开发的国产商用密码开源库|### Apache License 2.0,#### Permissions,-    Commercial use
-    Modification
-    Distribution
-    Patent use
-    Private use
,#### Limitations,-    Trademark use
-    Liability
-    Warranty
,#### Conditions,-    License and copyright notice
-    State changes
|  
|
|  
|  [GitHub - Tongsuo-Project/Tongsuo at 8.3.1](https://github.com/Tongsuo-Project/Tongsuo/tree/8.3.1)  ,  
|BabaSSL是一个现代的密码学和通信安全协议的基础库。BabaSSL诞生于阿里巴巴集团和蚂蚁集团内部。后续改名为  **铜锁**|  [Apache-2.0 license](https://github.com/Tongsuo-Project/Tongsuo/blob/master/LICENSE.txt)  |  
|


JDBC：此sr不支持TLCP，有单独sr支持。

  


### 配置参数

服务端：全局配置参数/重启生效

|参数名称|值|说明|
|:---|:---|:---|
|ssl_type|TLS/TLCP|选择协议类型，默认为TLS|
|TLCP_CERT_FILE|双证书文件|包含三个证书：cacert/signcert/enccert。,cat signcert.pem > double_certs.pem    
  cat enccert.pem >> double_certs.pem    
  cat cacert.pem >> double_certs.pem|
|TLCP_SIGNKEY_FILE|signcert.pem的密钥|  
|
|TLCP_ENCKEY_FILE|enccert.pem的密钥|  
|
|TLCP_CACERT_FILE|cacert.pem|  
|
|TLCP_SIGN_PASS|TLCP_SIGNKEY_FILE 的密码|此参数为隐藏参数。|
|TLCP_ENC_PASS|TLCP_ENCKEY_FILE 的密码||
|TLCP_SERVER_CIPHERS|加密套|  
|


客户端：$YASDB_HOME/client/yasc_env.ini

|参数名称|值|说明|
|:---|:---|:---|
|TLCP_CACERT_FILE|  
|  
|
|TLCP_CERT_FILE|  
|  
|
|TLCP_CLIENT_KEY_FILE|  
|  
|
|TLCP_CLIENT_KEY_PASS|  
|  
|
|TLCP_CLIENT_CIPHERS|加密套|  
|


### 加密方式确认

服务端给客户端的AckConn-》encryMode决定此次会话使用的加密模式。

版本兼容：

|客户端|服务端|类型|
|---|---|---|
|低版本|低版本--服务端配置SSL|SSL|
|  
|**高版本--服务端配置TLCP**|**报错，协议不兼容。**|
|高版本|低版本--服务端配置SSL|成功走SSL|
|  
|高版本--服务端配置TLCP|走TLCP|


TLCP/SSL类型确认流程：

tcp连接成功，服务端配置，回AckConn；客户端根据AckConn-》CsEncryMode来走不同的协议TLS/TLCP。

```
typedef enum EnCsEncryMode {
    CS_ENCRYPTMODE_LOGIN_SECURITY = 1,
    CS_ENCRYPTMODE_SSL = 2,
    CS_ENCRYPTMODE_TLCP = 3, --新增类型。
    __CS_ENCRYPTMODE_COUNT__,
} CsEncryMode;
```

  


### 接口变更

以GmSSL  为例。GmSSL  支持国密

数据结构：

TLS_CTX--全局唯一，属性设置

TLS_CONNECT --每个Cslink一个，属性使用TLS_CTX

函数：

|功能|SSL|TLCP|说明|
|---|---|---|---|
|  
|SSL_CTX_new|TLS_CTX ctx; ,int tls_ctx_init(TLS_CTX *ctx, int protocol, int is_client);|初始化CTX|
|  
|SSLv23_server_method,SSLv23_client_method|TLS_server_mode,TLS_client_mode,协议选择：TLS_protocol_tlcp,  
|  
|
|  
|不需要，封装在SSL_CONNECT|tls_do_handshake|TCLP/SSL层面握手|
|  
|SSL_CTX_set_cipher_list|tls_ctx_set_cipher_suites|设置密码套件|
|  
|SSL_new|tls_init|通过SSL_new(SSL_CTX*ctx)创建SSL安全通信的对象|
|  
|SSL_set_fd|tls_set_socket|将socketFd设置到SSL链接，后续SSL的读写，使用此链接|
|  
|SSL_write|tls_send|写|
|  
|SSL_read|tls_recv|读|
|  
|SSL_CTX_free|tls_ctx_cleanup|释放SSL_CTX|
|  
|SSL_free|tls_cleanup|释放SSL链接|
|  
|SSL_CTX_load_verify_locations|tls_ctx_set_ca_certificates|加载可信任证书（根证书）|
|  
|SSL_CTX_use_certificate_chain_file|tls_ctx_set_certificate_and_key|加载二级证书|


### 流程

TLS/TLCP在YashanD的初始化/介入/释放流程是一致的。此处不再讲述    [SSL连接 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=83921476)  

### 配置

（1）服务端 $YASDB_DATA/config/yasdb.ini

```
ssl_enable = on
ENCRYPT_TYPE = tlcp
TLCP_CERT_FILE = D:\anchorhome\TLCP\double_certs.pem
TLCP_SIGNKEY_FILE = D:\anchorhome\TLCP\signkey.pem
TLCP_ENCKEY_FILE = D:\anchorhome\TLCP\enckey.pem
TLCP_CACERT_FILE = D:\anchorhome\TLCP\cacert.pem
TLCP_PASS_FILE = D:\anchorhome\TLCP\tlcpPass
```

tlcpPass文件：D:\anchorhome\TLCP\tlcpPass

```
TLCP_ENC_PASS = 1234
TLCP_SIGN_PASS = 1234
```

（2）客户端：$YASDB_HOME/client/yasc_env.ini

```
TLCP_CACERT_FILE=D:\anchorhome\TLCP\rootcacert.pem
TLCP_CERT_FILE=D:\anchorhome\TLCP\clientcert.pem
TLCP_CLIENT_KEY_FILE=D:\anchorhome\TLCP\clientkey.pem
TLCP_CLIENT_KEY_PASS = 1234
```

##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=107391731#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

##   [7. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

|端到端形式|工作量|说明|
|---|---|---|
|C/S|c驱动+Yashan --,JDBC适配-- 不在此sr适配,其他驱动--依赖C驱动，验证即可|  
|
|HA|  
|  
|


##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

### 问题记录：

|问题|解决方式|  
|  
|
|---|---|---|---|
|1.tls_ctx_set_tlcp_server_certificate_and_keys不成功，原因：    
  证书的字符集问题。utf8重新拷贝粘贴即可。|  
|  
|  
|
|2.handshake 非阻塞问题。。我们的socket的fd是非阻塞的，我们自己通过poll来配合非阻塞。GMSSL的handshake流程，存在多次报文交互，都是block阻塞形式，且不提供send/Recv的注册（openssl-TLS提供注册，我们更换成带poll envent_in等待的形式）。|我们强制在GMSSL的握手阶段，将SocketFD改成阻塞。握手结束，再改回来|  
|  
|
|2.阻塞超时：解决问题2时，SO_SNDTIMEO/SO_RCVTIMEO的超时时间太短，会超时|我们强制在GMSSL的握手阶段，增大超时时间|  
|  
|


### 进度：

7.10流程已走通，包为GMTLS(TLCP)

![](https://pingcode.yasdb.com/atlas/files/public/67396d64a1ad9a3311dc90e7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQkFFQUFBQUFBQUVBUUFBQUFCQUFBQUFnQUFBQUFBQUFBQUJBQ0FBQUVBQUFCQUFBQVFCWUJBQUFBQUFCRUFBQUFBQUFRQUFDQUFnQUFBQUFBQUJJQUFBQVFBQUFBQUFBQUFBQUFBQ0NBQUFBRVFBQUFBQUlBQUFBQUFFQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFRZ0NBQUFBQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc4OTEsImV4cCI6MTc4MjMxODY5MX0.EVON599UOZp-qE819GucsDitA07jdlkTNxx9zKZcHlU)

### 疑难问题记录

GMSSL库，功能简陋，使用过程中问题记录如下

|问题描述|解决思路|解决进度|
|---|---|---|
|1.编译问题：,GMSSL 3.1中rand_bytes依赖较高版本的glibc。需要升级环境glibc|更改GMSSL源码，随机数用/dev下的随机数生成器|完成|
|2.GMSSL中的sokcet都是默认  阻塞！yashan是非阻塞（配合polll来完成数据的收发），GMSSL中tls_recv假如有5个环节，第三个环节recv失败，直接退出，yashan发现非阻塞的socket返回EWOULDBLOCK，继续recv，重新走tls_recv的流程，前3个环节的数据已经从TCP_RECVBUF获取，校验过不了。|修改GMSSL，tls_recv中的recv如果是EWOULDBLOCK等可忽略的错误，再次recv|完成|
|2.数据量大，GMSSL服务端将包的HMAC，客户端重算HMAC，发现对不上，报错。  --注意：什么是HMAC，HMAC作用参考    [SSL连接 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=83921476)  |1.hmac用的国密的SM4：sm4_cbc_encrypt/ sm4_cbc_decrypt加解密，把计算搞清楚，看是哪个环节出错。|  
|


### 问题2定位过程：

GMSSL中的协议报文格式：

![](https://pingcode.yasdb.com/atlas/files/public/67396d64a1ad9a3311dc90e8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQkFFQUFBQUFBQUVBUUFBQUFCQUFBQUFnQUFBQUFBQUFBQUJBQ0FBQUVBQUFCQUFBQVFCWUJBQUFBQUFCRUFBQUFBQUFRQUFDQUFnQUFBQUFBQUJJQUFBQVFBQUFBQUFBQUFBQUFBQ0NBQUFBRVFBQUFBQUlBQUFBQUFFQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFRZ0NBQUFBQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc4OTEsImV4cCI6MTc4MjMxODY5MX0.EVON599UOZp-qE819GucsDitA07jdlkTNxx9zKZcHlU)

流程：分组/加密/HMAC 传输 ----------解密/校验HMAC。错误在HMAC校验不过。原以为iv/key等不对，或者sm4_cbc_encrypt/ sm4_cbc_decrypt算法的问题。后续发现是  **内存踩踏！！**

问题根因，GMSSL中有内存踩踏，明文填充后加密，解密后相对明文有padding，用原始大小的buffer去接受padding后的数据。

解决方式：试图增加其buffer，使其与密文一致。

### 达梦

#### 1.配置参数

|参数|默认值|  
|
|---|---|---|
|ENABLE_ENCRYPT|0/静态|用于通信加密。基于传输层的SSL协议通信加密所采用的方式。取值0、1和2。    
  0：不开启SSL加密和SSL认证；    
  1：开启SSL加密和SSL认证。此时如果没有配置好SSL环境，则通讯仍旧不加密；    
  2：开启SSL认证但不开启SSL加密。此时如果服务器SSL环境没有配置则服务器无法正常启动，如果客户端SSL环境没有配置则无法连接服务器    
  3：开启GMSSL加密，采用国密TLCP通信协议。此时如果没有配置好GMSSL环境，则无法启动服务器。LINUX专用取值，若在WINDOWS环境下设为3将强制置为0，不使用传输层加密|
|  
|  
|  
|


2.双证书制作：

```
gmssl sm2keygen -pass 1234 -out rootcakey.pem
gmssl certgen -C CN -ST Beijing -L Haidian -O PKU -OU CS -CN ROOTCA -days 3650 -key rootcakey.pem -pass 1234 -out rootcacert.pem -key_usage keyCertSign -key_usage cRLSign -ca
gmssl certparse -in rootcacert.pem

--服务端
gmssl sm2keygen -pass 1234 -out cakey.pem
gmssl reqgen -C CN -ST Beijing -L Haidian -O PKU -OU CS -CN "Sub CA" -key cakey.pem -pass 1234 -out careq.pem
gmssl reqsign -in careq.pem -days 365 -key_usage keyCertSign -path_len_constraint 0 -cacert rootcacert.pem -key rootcakey.pem -pass 1234 -out cacert.pem -ca
gmssl certparse -in cacert.pem

gmssl sm2keygen -pass 1234 -out signkey.pem
gmssl reqgen -C CN -ST Beijing -L Haidian -O PKU -OU CS -CN localhost -key signkey.pem -pass 1234 -out signreq.pem
gmssl reqsign -in signreq.pem -days 365 -key_usage digitalSignature -cacert cacert.pem -key cakey.pem -pass 1234 -out signcert.pem
gmssl certparse -in signcert.pem

gmssl sm2keygen -pass 1234 -out enckey.pem
gmssl reqgen -C CN -ST Beijing -L Haidian -O PKU -OU CS -CN localhost -key enckey.pem -pass 1234 -out encreq.pem
gmssl reqsign -in encreq.pem -days 365 -key_usage keyEncipherment -cacert cacert.pem -key cakey.pem -pass 1234 -out enccert.pem
gmssl certparse -in enccert.pem

cat signcert.pem > double_certs.pem
cat enccert.pem >> double_certs.pem
cat cacert.pem >> double_certs.pem

--客户端
gmssl sm2keygen -pass 1234 -out clientkey.pem
gmssl reqgen -C CN -ST Beijing -L Haidian -O PKU -OU CS -CN Client -key clientkey.pem -pass 1234 -out clientreq.pem
gmssl reqsign -in clientreq.pem -days 365 -key_usage digitalSignature -cacert cacert.pem -key cakey.pem -pass 1234 -out clientcert.pem
gmssl certparse -in clientcert.pem
```

需要用户自己安装gmssl，生成相关证书配置

**测试点**

数据量：

        大数据量的查询 wait操作

兼容性：

        高低版本

部署形态：

        ha相关， 只支持c/s   c驱动

yasql：

       客户端 ctrl + c，link相关接口

内存泄漏：

        客户端：多个conn，disconn

        服务端：shutdown流程

**HA模式：**

正常开启HA_SSL_ENABLE，功能正常，走SSL，配置的TLCP不生效

主备配置如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396d64a1ad9a3311dc90e9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQkFFQUFBQUFBQUVBUUFBQUFCQUFBQUFnQUFBQUFBQUFBQUJBQ0FBQUVBQUFCQUFBQVFCWUJBQUFBQUFCRUFBQUFBQUFRQUFDQUFnQUFBQUFBQUJJQUFBQVFBQUFBQUFBQUFBQUFBQ0NBQUFBRVFBQUFBQUlBQUFBQUFFQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFRZ0NBQUFBQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc4OTEsImV4cCI6MTc4MjMxODY5MX0.EVON599UOZp-qE819GucsDitA07jdlkTNxx9zKZcHlU)

、

当主备关闭REPLICATION_ADDR，只走客户端监听的配置时，配置如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396d648970c2af4f521278/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQkFFQUFBQUFBQUVBUUFBQUFCQUFBQUFnQUFBQUFBQUFBQUJBQ0FBQUVBQUFCQUFBQVFCWUJBQUFBQUFCRUFBQUFBQUFRQUFDQUFnQUFBQUFBQUJJQUFBQVFBQUFBQUFBQUFBQUFBQ0NBQUFBRVFBQUFBQUlBQUFBQUFFQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFRZ0NBQUFBQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc4OTEsImV4cCI6MTc4MjMxODY5MX0.EVON599UOZp-qE819GucsDitA07jdlkTNxx9zKZcHlU)

此时表现：

当备机还未build时，执行build失败

![](https://pingcode.yasdb.com/atlas/files/public/67396d648970c2af4f521279/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQkFFQUFBQUFBQUVBUUFBQUFCQUFBQUFnQUFBQUFBQUFBQUJBQ0FBQUVBQUFCQUFBQVFCWUJBQUFBQUFCRUFBQUFBQUFRQUFDQUFnQUFBQUFBQUJJQUFBQVFBQUFBQUFBQUFBQUFBQ0NBQUFBRVFBQUFBQUlBQUFBQUFFQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFRZ0NBQUFBQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc4OTEsImV4cCI6MTc4MjMxODY5MX0.EVON599UOZp-qE819GucsDitA07jdlkTNxx9zKZcHlU)

当备机build成功--》改配置–》重启，此时在主上执行的dml，ddl将无法同步到备，发现在备机/data/code/ha/app/data/db-1-2/log/listener 有通信相关的ERR日志

此时重新更改配置端口正确后，发现无ERR继续打出，同步正常

![](https://pingcode.yasdb.com/atlas/files/public/67396d65a1ad9a3311dc90ea/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQkFFQUFBQUFBQUVBUUFBQUFCQUFBQUFnQUFBQUFBQUFBQUJBQ0FBQUVBQUFCQUFBQVFCWUJBQUFBQUFCRUFBQUFBQUFRQUFDQUFnQUFBQUFBQUJJQUFBQVFBQUFBQUFBQUFBQUFBQ0NBQUFBRVFBQUFBQUlBQUFBQUFFQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFRZ0NBQUFBQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc4OTEsImV4cCI6MTc4MjMxODY5MX0.EVON599UOZp-qE819GucsDitA07jdlkTNxx9zKZcHlU)

修改方案：

c/s  监听   && ssl_enable =on && encry_type =tlcp -->   启动报错    


![](https://pingcode.yasdb.com/atlas/files/public/67396d65a1ad9a3311dc90eb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQkFFQUFBQUFBQUVBUUFBQUFCQUFBQUFnQUFBQUFBQUFBQUJBQ0FBQUVBQUFCQUFBQVFCWUJBQUFBQUFCRUFBQUFBQUFRQUFDQUFnQUFBQUFBQUJJQUFBQVFBQUFBQUFBQUFBQUFBQ0NBQUFBRVFBQUFBQUlBQUFBQUFFQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFRZ0NBQUFBQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc4OTEsImV4cCI6MTc4MjMxODY5MX0.EVON599UOZp-qE819GucsDitA07jdlkTNxx9zKZcHlU)

  


  


## Attachments:

[image2024-4-10_10-35-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNjRhMWFkOWEzMzExZGM5MGU0IiwicmVmX2lkIjoiNjczOTZkNjQ1OTNmOTljOWZmMjM3YWU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3ODkxLCJleHAiOjE3ODIzOTQyOTF9.O6rdZv1oB-F-2NzLBuK_MY3r5Ed_Zzma23moYh8bhdQ)

 (image/png)    


[image2024-4-18_9-35-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNjQ4OTcwYzJhZjRmNTIxMjc0IiwicmVmX2lkIjoiNjczOTZkNjQ1OTNmOTljOWZmMjM3YWU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3ODkxLCJleHAiOjE3ODIzOTQyOTF9.Rk2oOS5rCYgCKl_O24ieO-GG9MKAdAeLb5qo1sZFC-U)

 (image/png)    


## Comments:

|  [](null)  ,会议纪要 2024.4.12,与会人：史鑫，刘晓璇，冯皓博，程康,需要用户自己安装gmssl，生成相关证书配置,**测试点**,数据量：,        大数据量的查询 wait操作,兼容性：,        高低版本,部署形态：,        ha相关， 只支持c/s   c驱动,yasql：,       客户端 ctrl + c，link相关接口,内存泄漏：,        客户端：多个conn，disconn,        服务端：shutdown流程,Posted by chengkang at 四月 16, 2024 18:53|
|---|
