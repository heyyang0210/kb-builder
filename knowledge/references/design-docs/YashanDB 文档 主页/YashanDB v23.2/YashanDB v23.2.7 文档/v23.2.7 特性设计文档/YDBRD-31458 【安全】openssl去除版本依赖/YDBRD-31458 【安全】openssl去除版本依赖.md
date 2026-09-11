Created by 史鑫 on 十月 18, 2024

源码：    [[ 1.1.1 ] - /source/old/1.1.1/index.html (openssl.org)](https://www.openssl.org/source/old/1.1.1/index.html)  

最终最低版本限制到  **1.1.1**

|  
|number|str|版本日期|interface|
|---|---|---|---|---|
|1.1.1M:|# define OPENSSL_VERSION_NUMBER 0x101010dfL  |# define OPENSSL_VERSION_TEXT "OpenSSL 1.1.1m 14 Dec 2021"|2021 10月|- number :   unsigned long OpenSSL_version_num(void)
- str:  const char *OpenSSL_version(int t)
|
|1.1.1L: |# define OPENSSL_VERSION_NUMBER 0x101010cfL  |# define OPENSSL_VERSION_TEXT "OpenSSL 1.1.1l 24 Aug 2021"|2021 8月||
|1.1.1K:|# define OPENSSL_VERSION_NUMBER 0x101010bfL |# define OPENSSL_VERSION_TEXT "OpenSSL 1.1.1k 25 Mar 2021"|2021 3月||
|**1.1.1**|**# define OPENSSL_VERSION_NUMBER 0x1010100fL**,**（269488143）**|**# define OPENSSL_VERSION_TEXT "OpenSSL 1.1.1 11 Sep 2018"**|**有EVP_PKEY_set_alias_type**||
|1.1.1-pre1,此版本最好不用。|# define OPENSSL_VERSION_NUMBER 0x10101001L （269488129）|# define OPENSSL_VERSION_TEXT "OpenSSL 1.1.1-pre1 (alpha) 13 Feb 2018"|1.1.1的最低版本，以此为版本试下,  
,没有EVP_PKEY_set_alias_type||
|  
|  
|  
|  
||


- 问题：
    - 1.1.0XXXX 中没有OpenSSL_version_num接口。低版本以  SSLeay获取版本，但是     1.1.0+版本将SSLeay废弃。  **此接口出现不兼容问题**  。  --解决方式：OpenSSL_version_num拿不到一定是低版本。就报错
- 自测结果：
    - 1.1.1K的加载：有OpenSSL_version_num符号，但是version低
        - [root@AchorBase bin]# ./yasdb    
  failed to check dynamic library LIBCRYPTO, min version required is 1.1.1L    
  Failed to start instance
    - 1.1.0的加载–此时没有OpenSSL_version_num符号
        - [root@AchorBase bin]# ./yasdbEVP_DigestInit_ex    
  failed to check dynamic library LIBCRYPTO, min version required is 1.1.1L    
  Failed to start instance


### 1.0.2u是1.0的最高版本，以下函数没有：

基本上所有的国密算法都不支持。

|算法|yashan的用途|  
|
|---|---|---|
|EVP_sm4_ctr|TDE|  
|
|EVP_sm3|密码|  
|
|EVP_sm4_cbc|内置函数|  
|


### yashan使用openssl函数版本能力汇总

- **1.0.X --1.1.0 --1.1.1：**
    - **现阶段是限制到1.1.1**
    - **建议限制到1.1.0。因为<1.1.0会有一些业务的逻辑需要修改，以下逻辑要适配或者报错：**
        - **openssl初始化/释放逻辑**
        - **SSL：BIO的读写等**


**待确认问题：**

**（1）我们最低支持：**

- 1.1.0版本可以不？  **1.1.0不支持的函数，允许读不到，可以起库。1.0.XX 不支持的函数，太多了，如果允许这些都不到，则需要大量逻辑适配。（136个函数）**


|函数|openssl引入的版本|版本及问题记录|yashan依赖的业务|
|---|---|---|---|
|RAND_bytes    
  AES_set_encrypt_key    
  AES_set_decrypt_key    
  AES_cbc_encrypt    
  SHA256_Init    
  SHA256_Update    
  SHA256_Final    
  SHA1    
  ERR_get_error    
  BIO_new    
  BIO_free    
  DH_check    
  DH_free    
  OBJ_sn2nid,BIO_s_socket,EC_KEY_new_by_curve_name,EC_KEY_free,BIO_clear_flags,  
,BIO_int_ctrl,BIO_s_file,BIO_set_flags,BIO_ctrl,PEM_read_bio_DHparams,ERR_reason_error_string,EVP_CIPHER_CTX_new,EVP_CIPHER_CTX_free,EVP_EncryptInit_ex,EVP_DecryptInit_ex,EVP_CIPHER_CTX_set_padding,EVP_EncryptUpdate,EVP_DecryptUpdate,EVP_aes_128_ctr,EVP_aes_192_ctr,EVP_aes_256_ctr,EVP_EncodeBlock,EVP_DecodeBlock,MD5_Init,MD5_Update,MD5_Final,EVP_DigestInit_ex,EVP_DigestUpdate,EVP_DigestFinal_ex,EC_KEY_new,EC_GROUP_new_by_curve_name,EC_KEY_set_group,EC_KEY_new,EC_GROUP_new_by_curve_name,EC_KEY_set_group,EC_KEY_generate_key,EC_KEY_get0_private_key,BN_bn2hex,EC_KEY_get0_public_key,EC_POINT_point2hex,EC_KEY_get_conv_form,HMAC_Init_ex,HMAC_Update,HMAC_Final,BN_bin2bn,EC_KEY_set_private_key    
  EC_KEY_get0_group    
  EC_POINT_new    
  EC_POINT_mul    
  EC_KEY_set_public_key    
  EVP_PKEY_new    
  EVP_PKEY_set1_EC_KEY,EVP_PKEY_CTX_new    
  EVP_PKEY_CTX_ctrl,EVP_DigestSignInit,EVP_DigestSignFinal,EVP_EncryptFinal_ex,  
  EC_GROUP_free    
  EC_POINT_free    
  EVP_PKEY_CTX_free    
  EVP_PKEY_free    
  EC_GROUP_get_degree    
  EC_POINT_set_affine_coordinates_GFp,EC_POINT_get_affine_coordinates_GFp    
  EVP_PKEY_assign    
  EVP_PKEY_encrypt_init    
  EVP_PKEY_encrypt    
  EVP_PKEY_decrypt_init    
  EVP_PKEY_decrypt    
  EVP_DecryptFinal_ex    
  EVP_aes_128_cbc,EVP_des_cbc,EVP_des_ede_cbc,EVP_des_ede3_cbc,EVP_DigestVerifyInit    
  BIO_read,  
,BN_CTX_new    
  BN_CTX_free    
  BN_CTX_start    
  BN_CTX_get,  
,BN_cmp    
  BN_value_one    
  BN_mod_add,BN_free    
  ECDSA_SIG_new    
  ECDSA_SIG_free,  
,EC_KEY_set_conv_form    
  EC_POINT_hex2point    
  EVP_DigestVerifyInit,  
,CRYPTO_free|**>= 1.0.XX 均兼容**|  
|  
|
|OPENSSL_init_crypto,OPENSSL_cleanup|- 1.1.0引入的
|- >=1.0.XX 才有
- OPENSSL_init_crypto：1.0.XX没有，函数：   OPENSSL_config(  NULL  )，平替。但不确定受否有问题
- OPENSSL_cleanup：<=1.0.XX   在程序结束时不需要显式地调用任何清理函数
,  
,  
,- **这个地方重要的点要确认，既然openssl自己可以自动释放，为啥我们要改成显式释放。之前有core，改成显式释放。**
- **core的原因：**
,**之前之所以显式释放，是因为，前台线程之前是detach的（真的detach，现在都是假的detach），会有一个问题。**,- ***step1:openssl隐式释放，当yasdb进程退出时，atexit（）会触发openssl的清理。***
- ***step2:前台线程的退出可能会很慢。不受主线程控制***
,***以上两个时间点，如果，step1快，step2慢，就会导致step2用到了step1的能力，产生core***,**问题修复方式：**,**一定保证所有的子线程退出后，yasdb再退出。即所有的子线程，必须由yasdb主线程阻塞方式回收。-》现有的机制就是主线程一个个回收完子线程，再退出，即所有的线程都是joinable的，都是假的detach。**,**因此低版本采用隐式释放，是没问题的。**|**做版本兼容。**,-  初始化/释放
    - OPENSSL_init_crypto
    - OPENSSL_cleanup
- 1.1.1L的man配置：OPENSSL_init_crypto.pod
    - OPENSSL_init_crypto
        - As of version 1.1.0 OpenSSL will automatically allocate all resources that it needs so no explicit   **initialisation**   is required. Similarly it will also automatically   **deinitialise**   as required.
,  
,  
,  
|
|BIO_set_data,BIO_get_new_index,BIO_meth_new,BIO_meth_set_read,BIO_meth_set_write,BIO_meth_set_create,BIO_meth_get_create,BIO_meth_set_destroy,BIO_meth_get_destroy,BIO_meth_set_ctrl,BIO_meth_get_ctrl,BIO_meth_get_callback,BIO_meth_set_callback,BIO_meth_get_puts,BIO_meth_set_gets,BIO_meth_set_puts,BIO_meth_get_gets,BIO_meth_free,BIO_get_data,EVP_CIPHER_CTX_reset,EVP_MD_CTX_new,EVP_MD_CTX_free,EVP_MD_CTX_reset,HMAC_CTX_new,HMAC_CTX_free,EC_GROUP_get0_order,ECDSA_SIG_get0,BN_is_zero,ECDSA_SIG_set0||.0.XX没有|  
,**可做参数检查**,-  SSL相关--可做ssl参数检查
    - BIO_set_data
    - BIO_get_new_index
    - BIO_meth_new
    - BIO_meth_set_read
    - BIO_meth_set_write
    - BIO_meth_set_create
    - BIO_meth_get_create
    - BIO_meth_set_destroy
    - BIO_meth_get_destroy
    - BIO_meth_set_ctrl
    - BIO_meth_get_ctrl
    - BIO_meth_get_callback
    - BIO_meth_set_callback
    - BIO_meth_get_puts
    - BIO_meth_set_gets
    - BIO_meth_set_puts
    - BIO_meth_get_gets
    - BIO_meth_free
    - BIO_get_data
- 密码hash摘要--可做参数检查
    - EVP_MD_CTX_new
    - EVP_MD_CTX_free
    - EVP_MD_CTX_reset
- 双因素认证--可做参数检查
    - EC_GROUP_get0_order
    - ECDSA_SIG_get0
    - BN_is_zero
    - ECDSA_SIG_set0
,  
,**使用报错**,- 内置函数    

    - EVP_MD_CTX_new
    - EVP_MD_CTX_free
- 内置函数：bifExecCryptHmac
    - HMAC_CTX_new
    - HMAC_CTX_free
- 基础EVP的流程
- 
- EVP_CIPHER_CTX_reset
|
|EVP_sm4_ctr,EVP_sm3,EVP_sm4_cbc,EVP_DigestSign,EVP_DigestVerify,**EVP_PKEY_set_alias_type --SM2的加解密/SM2的内置函数–1.1.1引入 3.0又去掉了**,EVP_MD_CTX_set_pkey_ctx --SM2的加解密/SM2的内置函数,  
|- 1.1.1引入的
|  
|  
,**内部兼容**,- **EVP_DigestVerify == EVP_DigestVerifyUpdate+EVP_DigestVerifyFinal**
,**使用报错**,-  表空间加密/备份加密
    - EVP_sm4_ctr
-  内置函数（SM2的加解密/SM2的内置函数）
    - EVP_PKEY_set_alias_type
    - EVP_MD_CTX_set_pkey_ctx
    - EVP_DigestSign
,- EC_POINT_get_affine_coordinates
    - >=1.1.1才有此函数
    - 低版本用EC_POINT_get_affine_coordinates_GFp替换（manpage里已说明）
    - 不做参数检查，内部替换成EC_POINT_get_affine_coordinates_GFp
,**可做参数检查**,- 密码摘要
    - EVP_sm3
- 密码传输    

    - EVP_sm4_cbc
,  
|


### 业务代码适配：

|函数|openssl版本|  
|
|---|---|---|
|OPENSSL_init_crypto,OPENSSL_cleanup|- 1.1.0引入的
|- >=1.1.1 才有
- OPENSSL_init_crypto：1.0.XX没有，函数：   OPENSSL_config(  NULL  )，平替。但不确定受否有问题
- OPENSSL_cleanup：<=1.0.XX   在程序结束时不需要显式地调用任何清理函数
|


### 业务提前检查：

|业务|函数|openssl版本|方案|
|---|---|---|---|
|SSL|- SSL相关
,BIO_set_data,BIO_get_new_index,BIO_meth_new,BIO_meth_set_read,BIO_meth_set_write,BIO_meth_set_create,BIO_meth_get_create,BIO_meth_set_destroy,BIO_meth_get_destroy,BIO_meth_set_ctrl,BIO_meth_get_ctrl,BIO_meth_get_callback,BIO_meth_set_callback,BIO_meth_get_puts,BIO_meth_set_gets,BIO_meth_set_puts,BIO_meth_get_gets,BIO_meth_free,BIO_get_data|- 1.1.0引入的
|- 冲突检查
,这些函数跟SSL_ENABLE+SSL_TYP=SSL做冲突检查|
|密码hash摘要|EVP_sm3,EVP_MD_CTX_new,EVP_MD_CTX_reset,EVP_MD_CTX_free|  
|- 冲突检查
,PASSWORD_HASH_METHOD = SM3,PASSWORD_LOGON_MIN_VERSION = SM3,- 建库参数校验（BOOT CTRL文件）：库中有SM3的密码
|
|密码传输|EVP_sm4_cbc|  
|- 冲突检查
,PASSWORD_CRYPTO_METHOD= SM4|


### 使用时报错：

|业务|函数|openssl版本|方案|
|---|---|---|---|
|TDE|EVP_sm4_ctr|  
|  
|
|内置函数|EVP_sm4_cbc,- bifExecCryptSign
    - EVP_DigestSign
|  
|  
|


### ssl库要跟crypto版本保持一致，ssl库1.0XX版本函数汇总

- libssl自己的版本兼容


|函数|1.0.0|1.1.0|3.0|
|---|---|---|---|
|SSL_CTX_free,SSL_CTX_use_certificate_chain_file,SSL_CTX_use_PrivateKey_file,SSL_CTX_check_private_key,SSL_CTX_ctrl,SSL_CTX_set_options,SSL_CTX_set_cipher_list,SSL_set_bio,SSL_new,SSL_set_verify,SSL_accept,SSL_CTX_load_verify_locations,SSL_connect    
  SSL_write    
  SSL_read    
  SSL_pending    
  SSL_shutdown    
  SSL_free    
  SSL_CTX_new,SSL_get_rbio|- SSL_CTX_set_options没有
    - SSL_CTX_ctrl(ctx, SSL_CTRL_OPTION, op, NULL) 平替
|有|有|
|- OPENSSL_init_ssl
    - 关系：
        - SSL_library_init()     –》  **OPENSSL_init_ssl**
        - SSL_load_error_strings()  --》  **OPENSSL_init_ssl**
        - OPENSSL_add_all_algorithms_noconf  **--》OPENSSL_init_ssl**
- TLS_server_method
    - SSLv23_server_method-》TLS_server_method
- TLS_client_method
    - SSLv23_client_method-》TLS_client_method
|- OPENSSL_init_ssl
    - SSL_library_init--通过函数解除对  **OPENSSL_init_ssl的依赖**
    - SSL_load_error_strings  --  通过函数解除对  **OPENSSL_init_ssl的依赖**
    - OPENSSL_add_all_algorithms_noconf  --  通过函数解除对  **OPENSSL_init_ssl的依赖**
- TLS_server_method
    - SSLv23_server_method --调函数
- TLS_client_method
    - SSLv23_client_method--调函数
|有|- **OPENSSL_init_ssl有**
- TLS_server_method --没
- TLS_client_method --没
|


- libssl对crypto的版本兼容


|业务|函数|1.1.0/1.0.0|3.0|
|---|---|---|---|
|SSL|- SSL相关
,BIO_set_data,BIO_get_new_index,BIO_meth_new,BIO_meth_set_read,BIO_meth_set_write,BIO_meth_set_create,BIO_meth_get_create,BIO_meth_set_destroy,BIO_meth_get_destroy,BIO_meth_set_ctrl,BIO_meth_get_ctrl,BIO_meth_get_callback,BIO_meth_set_callback,BIO_meth_get_puts,BIO_meth_set_gets,BIO_meth_set_puts,BIO_meth_get_gets,BIO_meth_free,BIO_get_data|- BIO_set_data             --贴上
- BIO_get_new_index  --不适配，直接返回
- BIO_meth_new         --sysmalloc
- BIO_meth_free --sysFree
- BIO_get_data --展开结构提获取
- BIO_meth_set_read --直接memcopy
- BIO_meth_set_write --直接memcopy
- BIO_meth_set_create --直接memcopy
- BIO_meth_get_create --直接memcopy
- BIO_meth_set_destroy --直接memcopy
- BIO_meth_get_destroy --直接memcopy
- BIO_meth_set_ctrl --直接memcopy
- BIO_meth_get_ctrl --直接memcopy
- BIO_meth_get_callback --直接memcopy
- BIO_meth_set_callback --直接memcopy
- BIO_meth_get_puts --直接memcopy
- BIO_meth_set_gets --直接memcopy
- BIO_meth_set_puts --直接memcopy
- BIO_meth_get_gets --直接memcopy
|都有|


![](https://pingcode.yasdb.com/atlas/files/public/67396e12a1ad9a3311dc9502/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFSQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVDQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTQwMDAsImV4cCI6MTc4MjMyNDgwMH0.yAY77WP7aGZYtUsSzAfUneDCGlJCzqv6u5Qv8TeiOLY)

### 2.0版本

### 3.0版本EVP_DigestVerifyInit

|函数|3.0XX版本是否有|
|---|---|
|EVP_PKEY_set_alias_type|没有|


要求：3.0加载成功/且所有功能能用

适配场景

- bifExecCryptSign-》  aniDigestSignSm2    
  bifExecCryptVerify-》  aniDigestVerifySm2：
    - 3.0版本 ： EVP_PKEY_assign 直接将类型搞成sm2。 ANI_EVP_PKEY_SM2
        - # ifndef OPENSSL_NO_EC：会根据曲线的类型，自行调整。最终调整对。此时，不管ANI_EVP_PKEY_SM2/ANI_EVP_PKEY_EC，只要曲线SM2，都正确，不用适配。  **因此直接去除（EVP_PKEY_set_alias_type）改别名的动作即可。**
        - # ifdef OPENSSL_NO_EC：一般都不会禁用此类型的。
    - 1.0版本：EVP_PKEY_assign  直接指定ANI_EVP_PKEY_SM2，不改类型。   ANI_EVP_PKEY_EC + 改类型EVP_PKEY_set_alias_type(pkey, ANI_NID_SM2) 
- bifExecCryptSign--aniDigestSignSm2    / bifExecCryptVerify -- aniDigestVerifySm2
    - 1.1xxx：EVP_PKEY_set1_EC_KEY类型是EVP_PKEY_EC，再改类型  EVP_PKEY_set_alias_type(pkey, ANI_NID_SM2) 
    - 3.0：
        - EVP_PKEY_set1_EC_KEY 内部也是走EVP_PKEY_assign，  **会自动改成曲线的类型**  。  **直接去除（EVP_PKEY_set_alias_type）改别名的动作即可。**
        - EVP_PKEY_CTX_ctrl(pkeyCtx, -1, -1, ANIEVP_PKEY_CTRL_SET1_ID，(CodInt32)signId->len, signId→str) 3.0有问题。去除可以
    - aniDigestSignSm2 /aniDigestVerifySm2
    - 结论：
        - 3.0版本，不用EVP_PKEY_set_alias_type/EVP_PKEY_CTX_ctrl
        - 1.0版本，用EVP_PKEY_set_alias_type+EVP_PKEY_CTX_ctrl
    - 待确认：不清楚openssl源码这些接口差异的原因，后续有空再看下源码确认吧


|版本|调用|结果|
|---|---|---|
|1.1|- 无EVP_PKEY_set_alias_type
|错|
||- 有EVP_PKEY_set_alias_type
- 无EVP_PKEY_CTX_ctrl(pkeyCtx, -1, -1, ANIEVP_PKEY_CTRL_SET1_ID，(CodInt32)signId->len, signId→str)
|错|
||- 有EVP_PKEY_set_alias_type
- 有EVP_PKEY_CTX_ctrl(pkeyCtx, -1, -1, ANIEVP_PKEY_CTRL_SET1_ID，(CodInt32)signId->len, signId→str)
|对|
|3.0|- 无EVP_PKEY_set_alias_type
- 有EVP_PKEY_CTX_ctrl(pkeyCtx, -1, -1, ANIEVP_PKEY_CTRL_SET1_ID，(CodInt32)signId->len, signId→str)
|错|
||- 无EVP_PKEY_set_alias_type
- 无EVP_PKEY_CTX_ctrl(pkeyCtx, -1, -1, ANIEVP_PKEY_CTRL_SET1_ID，(CodInt32)signId->len, signId→str)
|对,  
,  
|


自测：可起库，没有的接口已经适配，测试其他能力，3.0问题记录：

|问题|  
|结论|
|---|---|---|
|encrDecrypt sm4cbc解密，3.0版本结果不对，1.1版本没问题|用例：select crypt_decrypt('94131D3841F5DEDA81F7651CD7C2CF63', 'sm4', 'CBC', '12345678901234567890123456789012', '12345678901234567890123456789012' ) as xxxx from dual;,  
,定位：,3|  
|
|  
|  
|  
|


## 3.0编译

3.0的编译需要一些依赖：

### 配置yum:

# 创建备份目录    
  [root@hzk /]# mkdir -p /etc/yum.repos.d/backup/    
    
  # 备份本地yum包     
  [root@hzk /]# mv /etc/yum.repos.d/*.repo /etc/yum.repos.d/backup/

# 下载对应系统版本的阿里云yum源    
  [root@hzk /]# wget -O /etc/yum.repos.d/CentOs-Base.repo     [http://mirrors.aliyun.com/repo/Centos-7.repo](http://mirrors.aliyun.com/repo/Centos-7.repo)      
    
  # 下载epel开源发行软件包版本库,可以提供额外的软件包    
  [root@hzk /]# wget -O /etc/yum.repos.d/epel.repo     [http://mirrors.aliyun.com/repo/epel-7.repo、](http://mirrors.aliyun.com/repo/epel-7.repo、)  

# 删除缓存数据    
  yum clean all    
    
  # 创建元数据缓存    
  yum makecache

### 下载依赖

--编译3.0    
  yum install perl-IPC-Cmd

### 编译debug

--编译    
  cd /home/openssl/openssl-3/openssl-3.0.0    
  ./config --prefix=/home/openssl/openssl-3/openssl-3.0.0/install/ --debug no-tests    
  make    
  make install

### 调试：

export LD_LIBRARY_PATH=/home/openssl/openssl-3/openssl-3.0.0/install/lib64:$LD_LIBRARY_PATH    
  rm /home/yasdbhome/lib/    [libcrypto.so](http://libcrypto.so)    .1.1

cd /home/openssl/openssl-3/openssl-3.0.0/install/lib64     
  ln -s     [libcrypto.so](http://libcrypto.so)    .3     [libcrypto.so](http://libcrypto.so)    .1.1

## Attachments: