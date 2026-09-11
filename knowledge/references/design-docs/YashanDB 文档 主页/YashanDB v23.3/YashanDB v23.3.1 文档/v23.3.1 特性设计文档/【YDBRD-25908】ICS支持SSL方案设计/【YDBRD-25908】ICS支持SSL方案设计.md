Created by 陈俊杰, last modified on 十月 18, 2024

*详细设计-YDBRD-25908 : ICS支持SSL方案设计*

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf5d](https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf5d)      


*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6611a918579a3edb84d862ae](https://pingcode.yasdb.com/pjm/items/6611a918579a3edb84d862ae)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#1-%E6%80%BB%E8%BF%B0)  

SSL协议支持安全连接和数据加密传输，ICS需要支持SSL，实现数据传输保密性和完整性。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

国金认证对数据库信息传输保密性的要求，交付形态：分布式。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  


关联特性设计文档：    [SSL连接 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=83921476)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|新增配置参数|分布式新增配置参数DIN_SSL_ENABLE，设置为ON时DIN会使用SSL协议进行连接和传输|是|是|
|功能|DIN/ICS支持SSL|在DIN层完成配置参数的加载和回调注册，在ICS内核完成SSL的初始化，在ICS握手阶段完成SSL的握手，不关心CS层的收发细节|是|是|
|可修改性|集群和YCS的ICS未来可能支持SSL|实现时考虑代码层面的可扩展性，避免不恰当耦合|  
|  
|


##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#2-%E6%8E%A5%E5%8F%A3)  

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|配置参数|DIN_SSL_ENABLE|分布式新增配置参数DIN_SSL_ENABLE，设置为ON时DIN会使用SSL协议进行连接和传输|是|


- 参数名：  DIN_SSL_ENABLE
- 范   围：['ON', 'OFF']
- 默认值：OFF
- 作   用：分布式DIN是否开始SSL安全连接和加密传输的开关
- 设置方式：alter system set DIN_SSL_ENABLE='ON' scope='SPFILE'
- 生效方式：重启生效


  


*DIN是否开启SSL可根据DV$PARAMETER视图查询，DIN_STAT无需新增字段；*

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

|规格/约束|内容|原理|备注|
|---|---|---|---|
|规格|节点间参数配置必须一致|握手时校验节点间包括  DIN_SSL_ENABLE等  SSL相关参数配置，若不一致拒绝握手|  
|
|规格|私钥、二级证书、DH算法三个参数复用CS的配置|SSL_CERT_FILE\SSL_KEY_FILE\SSL_DH_PARAM_FILE三个参数复用CS的配置|  
|
|规格|私钥、二级证书、DH算法三个参数仅支持绝对路径|延续既有规格|  
|
|规格|UDS不开启SSL|延续既有规格|  
|
|规格|单机/集群下设置该参数为ON时会报错|该参数仅分布式下可用|  
|
|约束|集群和YCS的ICS不支持SSL配置和SSL连接|不在需求内支持|  
|
|约束|配置SSL后不完整支持扩缩容|SSL和扩缩容并无互斥问题，只是涉及到,1、集群SSL根证书管理,2、节点SSL私钥和二级证书的生成、SSL相关配置参数的设置,3、yasboot一键式配置分布式SSL等，需要未来进一步设计和om介入|  
|


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#4-%E7%89%B9%E6%80%A7)  

###   [4.1 DIN_SSL_ENABLE](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

- 参数名：  DIN_SSL_ENABLE
- 范   围：['ON', 'OFF']
- 默认值：OFF
- 作   用：分布式DIN是否开始SSL安全连接和加密传输的开关
- 设置方式：alter system set DIN_SSL_ENABLE='ON' scope='SPFILE'
- 生效方式：重启生效


###   [4.2 ICS支持SSL](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

#### 4.2.1 模块层次

![](https://pingcode.yasdb.com/atlas/files/public/67396ecea1ad9a3311dc9a0a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQkFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzkwNzUsImV4cCI6MTc4MjQ0OTg3NX0.9C5zv8vgcV187xoDVO0s-FjBaktMcAdVWNpZXhb8JX4)

1. 上层实例（如database和YCS实例）进行SSL证书制作、参数配置以及SSL动态库的加载
1. 适配层（如DIN和YCS_ICS）在ICS内核的初始化阶段注册IcsSSLProfile，其中包括
    1. SSL的开关状态
    1. 加载SSL配置参数的回调函数
    1. SSL动态库的回调函数
1. ICS层
    1. 新增配置项IcsSSLProfile，由适配层注册，ICS内核不关心SSL具体依赖哪些配置参数和lib
    1. 封装init、destroy、connect、accept等SSL相关的方法，在SSL的开关为ON时：    

        1. init：ICS启动tcp监听线程前初始化tcpLsnr上的SSLConfig
        1. connect：ICS主动握手方在收到成功的握手回应后进行SSL连接建立
        1. accept：ICS被动握手方在回复成功的握手回应后进行SSL连接接受
        1. destroy：ICS实例销毁时需要销毁init阶段初始化的SSLConfig上的sslCtx
1. CS层提供标准的收发接口，接口内根据cslink的类型选择是否使用SSL加密传输


#### 4.2.2 ICS建立SSL流程

  


![](https://pingcode.yasdb.com/atlas/files/public/67396ecfa1ad9a3311dc9a0b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQkFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzkwNzUsImV4cCI6MTc4MjQ0OTg3NX0.9C5zv8vgcV187xoDVO0s-FjBaktMcAdVWNpZXhb8JX4)

  


  


#### 4.2.3 相关数据结构变更

**ICS配置列表**

```
typedef struct StIcsSSLProfile {
    CodBool           sslOn;                 // SSL开关
    CodUint8          unused[7];
    SSLConfig*        sslConfig;             // 指向初始化过的SSLConfig（在TcpLsnr上）
    IcsLoadSSLConfig  icsLoadSSLConfig;      // 加载上层实例SSL相关配置的回调函数
    SSLCallBackSet*   sslCallBackSet;        // 上层实例动态链接的SSL回调函数集
} IcsSSLProfile;

typedef CodResult (*IcsLoadSSLConfig)(CodPointer inst, SSLConfig* config);
-inst: 上层实例指针
-config: 待加载的SSLConfig
```

  


**分布式属性列表**

```
typedef struct StAndAttr {
    CodUint64           features;
    CodChar*            dstbPoolBuf;

    ......              
 
    CodNodeType         nodeType;
    AndCbSet            andCbSet;
    CodBool             hasSyncGts;
    CodBool             isCnScalingOut;
    CodBool             sslOn;         // 新增
} AndAttr;

typedef struct StAndIcsMgr {
    AndAttr*       attr;
    CodPointer     getIcsProcessor;  // callback function for get dstb ics processor
    CodPointer     reportIcsEvent;   // report ics event
    CodPointer     sslCallBackSet;   // 新增，在dstb启动时从server层获取
    IcsManager*    icsMgr;
    CodUint16      startupVersion;
} AndIcsMgr;
```

  


#### 4.2.2 相关函数接口定义

```
CodResult icsSSLInit(IcsManager* mgr, SSLConfig* config);
/* 初始化SSL相关配置、SSLCtx到config */

CodResult icsSSLAccept(CsLink* link);
/* 服务端等待SSL握手并接受请求 */

CodResult icsSSLConnect(CsLink* link, SSLConfig* sslConfig);
/* 客户端发起SSL连接 */

CodVoid   icsSSLDestroy(IcsLsnr* lnsr);
/* 销毁SSLCtx */
```

  


###   [4.3 分布式SSL配置原则和示例](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

#### 4.3.1 SSL相关文件

保存路径：$YASDB_DATA/config/ssl，需要在每个节点创建该文件夹

```
[cjj@AchorBase data]$ ll cn-2-1/config/ssl/
total 28
-rw-rw-r-- 1 cjj cjj 1099 Jun 11 12:01 ca.crt         // 根证书
-rw-rw-r-- 1 cjj cjj 1704 Jun 11 12:01 ca.key
-rw-rw-r-- 1 cjj cjj   17 Jun 11 12:01 ca.srl
-rw-rw-r-- 1 cjj cjj 1500 Jun 11 12:01 dhparam.pem    // DH参数文件
-rw-rw-r-- 1 cjj cjj  989 Jun 11 12:01 server.crt     // 二级证书
-rw-rw-r-- 1 cjj cjj 3336 Jun 11 12:01 server.csr     // 证书签名请求
-rw-rw-r-- 1 cjj cjj 1704 Jun 11 12:01 server.key     // 服务端私钥
```

#### 4.3.2 根证书

- 生成方式：openssl req -new -x509 -days 365 -nodes -out ca.crt -keyout ca.key -subj "/CN=yashanDSTB"
- 保存方式：生成后复制并发送到每个节点的$YASDB_DATA/config/ssl，集群一致；扩缩容时需拷贝一份到目标组/节点


#### 4.3.3 DH参数文件

- 生成方式：openssl dhparam -2 -out dhparam.pem -text 2048
- 保存方式：生成后复制并发送到每个节点的$YASDB_DATA/config/ssl，集群一致；扩缩容时需拷贝一份到目标组/节点


#### 4.3.4 证书签名请求

- 生成方式：openssl req -new -nodes -text -out server.csr -keyout server.key -subj "/CN=yashanDSTB:cn-2-1"
- 保存方式：在目标节点$YASDB_DATA/config/ssl目录下生成即可


#### 4.3.5 二级证书

- 生成方式：openssl x509 -req -in server.csr -text -days 5 -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt
- 保存方式：在目标节点$YASDB_DATA/config/ssl目录下生成即可


#### 4.3.6 脚本示例

```
SSL_PATH="/data/ssl"       // 制作根证书的位置
cd $SSL_PATH
ls | grep dhparam.pem
dhExist=$?
if [[ $dhExist != 0 ]]; then
        openssl dhparam -2 -out dhparam.pem -text 2048   // 生成DH参数文件
fi
ls | grep ca.crt
caExist=$?
if [[ $caExist != 0 ]]; then
        openssl req -new -x509 -days 365 -nodes -out ca.crt -keyout ca.key -subj "/CN=yashanDSTB"     // 生成根证书
fi

// 创建各个节点SSL目录
MN_SSL_PATH="$YASDB_DATA/mn-1-1/config/ssl"
CN_SSL_PATH="$YASDB_DATA/cn-2-1/config/ssl"
DN_SSL_PATH="$YASDB_DATA/dn-3-1/config/ssl"
rm -rf $MN_SSL_PATH
rm -rf $CN_SSL_PATH
rm -rf $DN_SSL_PATH
mkdir $MN_SSL_PATH
mkdir $CN_SSL_PATH
mkdir $DN_SSL_PATH

// 复制根证书和DH参数文件到各个节点SSL目录
cp $SSL_PATH/dhparam.pem $MN_SSL_PATH
cp $SSL_PATH/dhparam.pem $CN_SSL_PATH
cp $SSL_PATH/dhparam.pem $DN_SSL_PATH
cp $SSL_PATH/ca.crt $MN_SSL_PATH
cp $SSL_PATH/ca.crt $CN_SSL_PATH
cp $SSL_PATH/ca.crt $DN_SSL_PATH
cp $SSL_PATH/ca.key $MN_SSL_PATH
cp $SSL_PATH/ca.key $CN_SSL_PATH
cp $SSL_PATH/ca.key $DN_SSL_PATH

// 分别到各个节点SSL目录生成证书签名请求和二级证书
cd $MN_SSL_PATH
openssl req -new -nodes -text -out server.csr -keyout server.key -subj "/CN=yashanDSTB:mn-1-1"
openssl x509 -req -in server.csr -text -days 5 -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt
cd ..
// 修改yasdb.ini配置参数
echo "DIN_SSL_ENABLE=ON" >> yasdb.ini
echo "SSL_CERT_FILE=$MN_SSL_PATH/server.crt" >> yasdb.ini
echo "SSL_KEY_FILE=$MN_SSL_PATH/server.key" >> yasdb.ini
echo "SSL_DH_PARAM_FILE=$MN_SSL_PATH/dhparam.pem" >> yasdb.ini

cd $CN_SSL_PATH
openssl req -new -nodes -text -out server.csr -keyout server.key -subj "/CN=yashanDSTB:cn-2-1"
openssl x509 -req -in server.csr -text -days 5 -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt
cd ..
echo "DIN_SSL_ENABLE=ON" >> yasdb.ini
echo "SSL_CERT_FILE=$CN_SSL_PATH/server.crt" >> yasdb.ini
echo "SSL_KEY_FILE=$CN_SSL_PATH/server.key" >> yasdb.ini
echo "SSL_DH_PARAM_FILE=$CN_SSL_PATH/dhparam.pem" >> yasdb.ini

cd $DN_SSL_PATH
openssl req -new -nodes -text -out server.csr -keyout server.key -subj "/CN=yashanDSTB:dn-3-1"
openssl x509 -req -in server.csr -text -days 5 -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt
cd ..
echo "DIN_SSL_ENABLE=ON" >> yasdb.ini
echo "SSL_CERT_FILE=$DN_SSL_PATH/server.crt" >> yasdb.ini
echo "SSL_KEY_FILE=$DN_SSL_PATH/server.key" >> yasdb.ini
echo "SSL_DH_PARAM_FILE=$DN_SSL_PATH/dhparam.pem" >> yasdb.ini
```

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

|场景类型|具体内容|预期|备注|
|---|---|---|---|
|配置参数|非ON和OFF，参数过长|报错不core|  
|
|SSL配置|某节点SSL开关配置与其他节点不一致|ICS握手阶段报错|  
|
||某节点SSL证书等与其他节点不一致|SSL连接阶段报错|  
|
|SSL保密性验证|使用tcpdump -i lo -X命令抓取数据包，对比SSL开启前后数据内容|  
|  
|
|SSL防篡改验证|使用sokit工具接收、篡改并转发|接收失败，发送方重发|  
|
|性能测试|ics_perf新增测试模式，对比性能差异|性能可能下滑但较小|  
|
||分布式开启SSL进行tpch测试|  
|  
|
|扩缩容场景摸底|扩缩容测试|无core，表现分析后明确到约束|  
|


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

1. SSL相关旧有资料无需修改
1. 分布式是否有需要修改说明的地方


##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

  


工作量评估：设计2人天，开发2人天，自测3人天

关键时间点：6-4   完成设计，6-5   开发评审，6-7   完成编码，  **6-12   转测**

  


  


## Attachments:

## Comments:

|  [](null)  ,1、考虑升级兼容性的问题     ----    [分布式网络兼容设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=95111536)  ,2、篡改的影响：校验不对、解密失败；接收失败时发送方能感知,3、参数修改是cluster级   ---om,4、扩缩容时需要拷贝参数，但证书等需要手动配       ---- 约束不支持扩缩容,5、分布式集群是网状通信，根证书要求集群一致,Posted by chenjunjie at 六月 05, 2024 17:52|
|---|
|  [](null)  ,自测记录    [【YDBRD-25908】需求自测记录](/pages/createpage.action?spaceKey=YASDOC&title=%E3%80%90YDBRD-25908%E3%80%91%E9%9C%80%E6%B1%82%E8%87%AA%E6%B5%8B%E8%AE%B0%E5%BD%95)  ,Posted by chenjunjie at 六月 11, 2024 17:01|
