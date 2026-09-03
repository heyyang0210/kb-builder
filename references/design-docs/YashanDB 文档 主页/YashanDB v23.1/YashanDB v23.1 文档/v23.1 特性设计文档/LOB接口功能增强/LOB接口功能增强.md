Created by 侯忠林, last modified on 七月 05, 2023

### 1. Overview（概述）

对比oracle的lob功能接口，我们还缺失很多接口，还有lob协议上次JDBC功能开发已经升级功能，这次补充增强的功能。还有部分功能性能太差，进行性能的提升。

### 2. Features（功能特性）

目前需要完成的接口主要包括lob数据的读取，lob数据的更新。  **新增接口5个，修改接口3个.**

调研文档：

  [OCI-LOB接口调研 - 侯忠林 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=104212504)  

  [LOB Functions (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/lob-functions.html#GUID-699FFE4B-07C8-4904-959F-3686E73B8188)  

  [LOB协议 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=68294902)  

###   
  3. Interfaces（接口）

LOB类型，目前只支持CLOB，BLOB。

  


**新增接口**

|接口|参数|说明|
|---|---|---|
|YacResult yacLobIsTemporary(YacHandle hConn, YacLobLocator* loc， YacBool* isTemporary)|1. hConn 句柄
1. loc 要操作的lob
1. isTemporary出参是否临时lob
|判断lob是否临时lob|
|YacResult yacLobRead2(YacHandle hConn, YacLobLocator* loc, YacUint64 * byteSize， YacUint64 * charSize， YacUint64 offset, YacUint8* buf, YacUint64 bufLen)|1. hConn 句柄
1. loc 要操作的lob
1. byteSize 出入参读取的字节大小
1. charSize 出入参读取的字符大小
1. offset 读取lob数据的偏移位置
1. buf 出参读取数据放入的buf
1. bufLen 读取数据放入的buf的大小
|从一定偏移位offset读取lob的数据,Clob读取的数据是已经转换为客户端字符集结果|
|YacResult yacLobWrite2(YacHandle hConn, YacLobLocator* loc, YacUint64 * byteSize， YacUint64 * charSize， YacUint64 offset,  YacUint8* buf, YacUint64 bufLen)|1. hConn 句柄
1. loc 要操作的lob
1. byteSize 出入参写数据字节大小
1. charSize 出入参写数据字符大小
1. offset 写lob数据的偏移位置
1. buf 写数据放入的buf
1. bufLen 写数据放入的buf的大小
|从一定偏移位offset写入ob的数据|
|YacResult yacLobWriteAppend(YacHandle hConn, YacLobLocator* loc, YacUint64 * byteSize， YacUint64 * charSize, YacUint8* buf, YacUint64 bufLen)|1. hConn 句柄
1. loc 要操作的lob
1. byteSize 出入参写数据字节大小
1. charSize 出入参写数据字符大小
1. buf 写数据放入的buf
1. bufLen 写数据放入的buf的大小
|从lob尾部追加写入数据|
|YacResult yacLobTrim(YacHandle hConn, YacLobLocator* loc, YacUint64 * newlen)|1. hConn 句柄
1. loc 要操作的lob
1. newlen 新的lob长度
|lob数据截取，newlen clob为字符长度，blob为字节长度|
|YacResult yacLobAppend(YacHandle hConn, YacLobLocator* dstLob, YacLobLocator* srcLob)|1. hConn 句柄
1. dstLob 要写入数据的lob
1. srcLob 要读取数据的lob
|将一个lob的数据追加到另一个lob后面|


**修改接口**

|接口|修改实现|
|---|---|
|YacResult yacLobDescAlloc(YacHandle hConn,   **YacType type,**   YacVoid** desc),增加通用方法：  **YacDescAlloc(YacHandle hConn, YacVoid** desc，YacUint8 type)**,**对应释放接口YacDescAlloc(YacHandle hConn, YacVoid** desc，YacUint8 type)**|删除lob类型，和oracle接口对齐，lob类型在以下两种情况下确定：,1. yacLobCreateTemporary创建临时lob
1. 在绑定参数fetch lob数据从服务端获取数据类型
|
|YacResult yacLobCreateTemporary(YacHandle hConn, YacLobLocator* loc),修改：YacResult   **yacLobCreateTemporary2**  (YacHandle hConn, YacLobLocator* loc,   **YacLobType lobType**  )|创建lob时增加lob类型,**lobType:YAC_TEMP_BLOB,YAC_TEMP_CLOB ,YAC_TEMP_NCLOB**|


  


### 4. Limitations（功能限制）

YacResult yacLobAppend(YacHandle hConn, YacLobLocator* dstLob, YacLobLocator* srcLob)    
  目前有两种情况不支持    
  1. srcLob如果是一个knllob在knl层不支持    
  2.srcLob和dstLob是同一个lob也不支持

由于服务端部分功能缺失，字符偏移读的功能目前无法实现。

### 5. Detail Design（详细设计）

#### **新增接口**

##### **1.YacResult yacLobIsTemporary(YacHandle hConn, YacLobLocator* loc， YacBool* isTemporary)**

描述：判断lob是否临时lob，初始化的lob返回false.

参数：

hConn ：入参，句柄

loc：入参， 操作的lob，lobLocator必须是有效值指向一个有效lob。

isTemporary：出参，是否临时lob

实现方式：目前在YacLobLocator上的flag标识记录了是否是临时lob，可以通过flag判断，不和服务端交互，hConn参数加上为了和  oracle保持一致。如果lob刚刚alloc出来没有创建也没有fetch,接口返回false。

  


##### **2.YacResult yacLobRead2(YacHandle hConn, YacLobLocator* loc, YacUint64 * byteSize， YacUint64 * charSize， YacUint64 offset, YacUint8* buf, YacUint64 **  **bufLen**  **)**

描述：lob从一定偏移位置读取一部分数据，byteSize读取数据字节大小，charSize读取数据字符大小，offset读取数据的偏移位。 

参数:

hConn：入参，句柄

loc：入参，要操作的lob，操作的lob，lobLocator必须是有效值指向一个有效lob。

byteSize：出入参，读取的字节大小。

                入参：要从读取的字节数，作用于BLOB。对于CLOB，只有当charSize为0时才会使用，存在读取  字符不对齐的情况向下取正，导致入参和出参大小不一致。

                出参：读取到buff里面数据的字节大小

charSize：出入参，读取的字符大小。

                入参：要读取的字符数，作用于CLOB。对于BLOB自动忽略

                出参：读取到buff里面数据的字符大小，BLOB忽略。

offset：入参，读取lob数据的偏移位置。对于BLOB是字节偏移位置，对于CLOB是字符偏移位置，第小值是1。

buf：出入参，读取数据放入的buf

bufLen：入参，读取数据放入的buf的字节大小

实现方式：

校验：不校验参数，buff里面能写多少写多少，但是字符对齐。

BLOB的数据读取，通过现有协议支持通过offset读取数据，如果读取数据过大，通过循环调用，计算offset实现大数据的读取。

**对于Clob的数据读取，offset表示字符偏移，现有协议不支持字符偏移计算，只能从位置**  **1开始读，读到offset位置后**  **，再读后面数据，性能很差。在读取一段数据以后更新本地cache,记录offset和此时的字节偏移和字符偏移的对应关系，提高下次读取数据性能。**

**客户端读取到的数据在本地再计算字符长度，返回的出参数据得是**  **做字符转换后的值，**  **是否要改协议，支持读数据的时候字符和字节offset。**

##### **3.YacResult yacLobWrite2(YacHandle hConn, YacLobLocator* loc, YacUint64 * byteSize， YacUint64 * charSize， YacUint64 offset,  YacUint8* buf, YacUint64 bufLen)**

描述：lob从固定位置写异常长度数据，byteSize写数据字节大小，charSize写数据字符大小，offset写数据的偏移位。offset的范围在1~lobSize + 1，bitySize和charSize必须都在bufLen范围内，不满足以上条件报错。

参数：

hConn：入参，句柄

loc：入参，要操作的lob，操作的lob，lobLocator必须是有效值指向一个有效lob。

byteSize:：出入参，写数据字节大小，存在读取  字符不对齐的情况向下取正。

                入参：要从写入的字节数，作用于BLOB。对于CLOB，只有当charSize为0时才会使用，存在读取  字符不对齐的情况向下取正，导致入参和出参大小不一致。

                出参：写入到数据库里面数据的字节大小

charSize： 出入参，写数据字符大小

                入参：要写入的字符数，作用于CLOB。对于BLOB自动忽略

                出参：写入倒是数据库里面数据的字符大小，BLOB忽略。

offset：入参，写入lob数据的偏移位置。对于BLOB是字节偏移位置，对于CLOB是字符偏移位置，第小值是1，最大值是LOB的最大字节/字符长度+1

buf ：入参，写数据存放的buf

bufLen ：入参，写数据存放buf的大小

实现方式：

校验：blob对charSize始终不校验，也不修改charSize返回参数，校验byteSize和bufflen的大小。clob在charSize不为零是校验buff里面能够提供charSize的字符数，不能报错。如果charSize为零则校验byteSize和bufflen的大小。

对于BLOB目前协议支持通过offset写入数据，从offset位置开始写入的数据按照字节大小覆盖后面的数据。

对于CLOB需要考虑字符集的转换：

1. 输入的数据先进行字符集转换，并校验字符总大小是否大于charSize的入参大小，不符合抛出异常。
1. 如果输入数据是byteSize，要根据字符集，做字符对齐
1. 确定好要写入的数据，数据的字符大小，字节大小以后，只要写入成功就返回的数据就是这些数据，不存在部分写入情况。
1. 由确定的写入的数据和字节大小，字符大小进行字符集转换后通过出参返回。


knlLob的大数据通过临时构造tempLo  b然后一次写入数据，  提升数据插入的性能。tempLob的大数据写入可以通过循环写实现

knlLob的数据写需要管理事务，在commit以后提交事务，roback以后回滚，lob信息需要初始化lob长度和缓冲区大小。savepoint暂时不考虑，所以在knllob写数据之前要加锁，select for update.

通过在connection上记录knllob的列表，在lob中增加update标识，在每次comm  it或者robac  k的时候，处理已经更新过的knllob，将lob数据进行更新或者回退,  roback后的更新lob不能再使用，直接报错。

##### **4.YacResult yacLobWriteAppend(YacHandle hConn, YacLobLocator* loc, YacUint64 * byteSize， YacUint64 * charSize, YacUint8* buf, YacUint64 bufLen)**

描述：将一部分数据追加到lob末尾。bitySize和charSize必须都在bufLen范围内，不满足以上条件报错。

参数：

hConn：入参，句柄

loc：入参，要操作的lob，操作的lob，lobLocator必须是有效值指向一个有效lob。

byteSize:：出入参，写数据字节大小，存在读取  字符不对齐的情况向下取正。

                入参：要从写入的字节数，作用于BLOB。对于CLOB，只有当charSize为0时才会使用，存在读取  字符不对齐的情况向下取正，导致入参和出参大小不一致。

                出参：写入到数据库里面数据的字节大小

charSize： 出入参，写数据字符大小

                入参：要写入的字符数，作用于CLOB。对于BLOB自动忽略

                出参：写入倒是数据库里面数据的字符大小，BLOB忽略。

buf ：入参，写数据存放的buf

bufLen ：入参，写数据存放buf的大小

实现方式：

校验：blob对charSize始终不校验，也不修改charSize返回参数，校验byteSize和bufflen的大小。clob在charSize不为零是校验buff里面能够提供charSize的字符数，不能报错。如果charSize为零则校验byteSize和bufflen的大小。

追加数据协议中对offset有特殊的标识位-1，以便识别是追加写动作，不用计算偏移位，增加数据的插入性能。

对于CLOB同样需要考虑字符集的转换：

1. 输入的数据先进行字符集转换，并校验字符总大小是否大于charSize的入参大小，不符合抛出异常。
1. 如果输入数据是byteSize，要根据字符集，做字符对齐
1. 确定好要写入的数据，数据的字符大小，字节大小以后，只要写入成功就返回的数据就是这些数据，不存在部分写入情况。
1. 由确定的写入的数据和字节大小，字符大小进行字符集转换后通过出参返回。


##### **5.YacResult yacLobTrim(YacHandle hConn, YacLobLocator* loc, YacUin**  **t64  newlen**  **)**

描述：lob截取数据，newLen的范围在0~lobSize，不满足以上条件报错。

参数：

hConn：入参，句柄

loc：入参，要操作的lob，操作的lob，lobLocator必须是有效值指向一个有效lob。

newlen：入参，lob截取后的长度。对于BLOB是字节长度，对于CLOB是字符长度，第小值是0，最大值是LOB的最大字节/字符长度

实现方式：

通过现有的trim协议直接传入nenlen长度即可，截取后同样要释放cache的缓存数据。

##### **6.YacResult yacLobAppend(YacHandle hConn, YacLobLocator* **  **dstLob, YacLobLocator* srcLob**  **)**

描述：将一个lob的数据追加到另一个lob上,dstLoc和srcLoc的lob类型必须一致，都是CLOB或者BLOB.要不报错LOB类型不一致。同一个log可以同时问dstLob和srcLob。

参数：

hConn：入参，句柄

dstLoc：出入参，要追加数据的lob，lobLocator必须是有效值指向一个有效lob。

srcLoc：入参，要读取数据的lob，lobLocator必须是有效值指向一个有效lob.

实现方式：

协议中有flag字段flag为1时标识传入的数据时一个loblocator，不是要写入的bites数据,将

#### **修改接口**

##### **1.YacResult yacLobDescAlloc(YacHandle hConn, YacType type, YacVoid** desc)**

增加通用方法：

YacDescAlloc(  YacHandle hConn, YacVoid** desc，YacUint8 type)

YacDescFree(YacHandle hConn, YacVoid** desc，YacUint8 type)

对比oracle并没有专门的LobDescAlloc方法，只是在通用的alloc方法上传入TYPE_LOB参数，并且在LobCreateTemporary时候传入lob类型CLOB或者BLOB。

我们目前的方法存在一下问题，yacLobDescAlloc一和BLOB，绑定参数可以用BLOB绑定一个CLOB，最后fetch的时候结果依然是CLOB。因为lob类型的确定实在fetch或者creatTempLob的时候，在这个时候传入lob类型最好。

  


##### **2.YacResult yacLobCreateTemporary(YacHandle hConn, YacLobLocator* loc)**

新增：YacResult yacLobCreateTemporary2(YacHandle hConn, YacLobLocator* loc, YacLobType lobType)

### 性能优化

#### **目前存在的问题**

1. lob读不支持字符偏移，需要增加lob读支持字符偏移位置。如果不加客户端需要lob从头开始读计算字符偏移位置。
1. lob获取字符长度是通过读取全部数据，客户端在本地计算字符长度累加出来的，性能极差。
1. lob读取的数据或者预取的数据返回的只有字节长度，没有字符长度，需要客户端本地计算。
1. lob数据发送大数据，循环发送调用lobwrite,发送性能很差，并且频繁进存储。


```
typedef struct StReqLob {
    CodUint8   opr;
    //CodUint8   flag;
    CodUint8   dataIsLob: 1;
    CodUint8   isStream:  1;
    CodUint8   isCharReq: 1;
    CodUint8   reserve  : 5;
    CodUint8   lobType;
    CodUint8   locLen;
    CodUint32  reqLen;
    CodUint64  offset;
    CsLobLocator locator;
} ReqLob;

CodResult ankVarLobLocatePos(AnkHandler* handler, VarLob* varLob, CodUint64 offset, CodUint64* pos);
```

#### **修改lob协议支持字符偏移的读：**

  


将原有的flag进行拆分，flag在第一版lob协议中没有使用，第二版协议中标识dataIsLob（只判断了第一位），发送的数据时候是一个Lob,新增isCharReq，标识offset是否是字符偏移位，只有在offset可以同时传字节字符的情况下有用。如果接口功能只能传字节或者字符偏移则不判断isCharReq。

服务端ankVarLobLocatePos方法可以将字符偏移位置转换为字节偏移位置。具体实现需要现有方法组合实现字符偏移位的读取功能。

#### **修改lob协议获取字符长度**

  


LobOpr 升级LOB_GET_LEN 操作读取字符长度 。增加客户端获取lob字符总长度，客户端通过type判断是否inrow，inrow直接计算，outrow请求服务端字符长度，请求字符长度时增加isCharReq标志。blob自动忽略。

这个操作对目前字符长度的性能有很大提升

服务端倒是有重新读取存储的性能问题，但是对整体来看性能提升还是很大的。

#### **修改lob write协议写入大数据**

  


lob在写入数据的时候，如果写入数据大于一个chunkSize，则通过流的形式发送数据。服务端在接收到流数据的时候在通过一个tempLob接收流数据，然后操作tempLob进行数据的写入。

这个操作对大数据的写入性能提升很大。

服务端的性能相对一次操作性能会变慢，但是整体的速度还是提升的，毕竟只进一次存储。

  


#### **驱动兼容LOB UTF16协议补充：**

驱动要记录服务端的LOB字符集（后续改成UTF16存）以便驱动进行字符集转换和字符大小转换，这个协议上要传输这个字符集标志给驱动：

方案一：AckConn修改增加一个字符集标志。    
  方案二：CMD_SESSION_PARAM的响应结果里面增加一条LOB字符集标志。

|  
|byte_offset|char_offset|byte_req_len|char_req_len|ack_byte_dataLen|ack_char_dataLen|total_byte_lobLen|total_char_lobLen|
|---|---|---|---|---|---|---|---|---|
|lob_read|req.offset|目前不支持,isCharOffset+req.offset|req.reqLen|目前不支持,isCharReqLen+req.reqLen|ack.dataLen|目前不支持,新增定义ack.value(前32位)|  
|  
|
|lob_write|req.offset|req.offset|req.reqLen|不需要，客户端自己保证字符对齐|不需要|不需要|ack.value|Clob ack.value表示字符长度|
|lob_prefetch|无|无|无|无|req.reqLen|无|无|无|


#### 协议升级兼容

1. LOB_GET_LEN的协议升级服务端需要对cmdver进行控制，只有在新版本的协议中进行字符长度的计算，也是在最新版本的链接中增加获取CLob字符长度的通过请求服务端LOB_GET_LEN的方法，把返回的长度当作字符长队处理。
1. Lob read支持offset字符偏移读，首先驱动对字符偏移读的方法要做版本控制，低版本不支持，新版版放开，服务端在新版本中对offset进行二义性处理，offset当作字符偏移处理。 
1. stream流的协议是新加的协议，只有新版本满足，老版本要走原来的模式。


#### 历史版本LOB协议

**1：**  表示一号版本协议

**2：**  表示二号版本协议

**3：**  表示此次协议升级新增功能

|**ORP**|**ReqLob**||||||||||**AckLob**||||||
|:---:|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
||opr|flag|flag：dataIsLob|flag：isStream|flag：isCharReq|lobType|locLen|reqLen|offset|locator|**locatorLen**|**hasData**|**eof**|**dataLen**|**value**|**locator**|
|LOB_GET_LEN|使用|未使用|  
|  
|  
|1:未使用,2:使用|使用（1版本和2版本的使用长度不一样）|使用（传0）|使用（传0）|使用|使用（1版本和2版本的使用长度不一样）|使用|未使用|返回数据的字节长度|**1：2：返回LOB字节长度**,**3：返回LOB字节长度/字符长度**|使用|
|LOB_READ|使用|未使用|  
|  
|**3:1表示offset reqLen是字符长度**|1:未使用,2:使用,  
|使用（1版本和2版本的使用长度不一样）|**1:2:请求字节长度**,**3：请求长度（CLOB字符/BLOB字节）**|**1：2：字节偏移位**,**3：偏移位（CLOB字符/BLOB字节）**|使用|使用（1版本和2版本的使用长度不一样）|使用|未使用|返回数据的字节长度|**未使用**,  
|使用|
|LOB_TRIM|**1:未使用**,**2:使用**|未使用|  
|  
|  
|1:未使用,2:使用|使用（1版本和2版本的使用长度不一样）|使用（传0）|**2:表示lob的新长度（CLOB字符/BLOB字节）**|使用|使用（1版本和2版本的使用长度不一样）|使用|未使用|返回数据的字节长度|**返回LOB字节长度**,  
|使用|
|LOB_WRITE|使用|**1:未使用**,**2:使用（1表示写入的数据是locator）**|**3:1表示写入的数据是locator**|**3:1表示写入的数据是流**|  
|1:未使用,2:使用|使用（1版本和2版本的使用长度不一样）|使用（传0）|**1:使用（传0）**,**2:表示写入数据的偏移位（CLOB字符/BLOB字节）**|使用|使用（1版本和2版本的使用长度不一样）|使用|未使用|返回数据的字节长度|**返回LOB字节长度**,  
|使用|
|LOB_TMP_CREATE|使用|未使用|  
|  
|  
|1:未使用,2:使用|使用（1版本和2版本的使用长度不一样）|使用（传0）|使用（传0）|使用|使用（1版本和2版本的使用长度不一样）|使用|未使用|返回数据的字节长度|未使用|使用|
|LOB_GET_CHUNK_SIZE|使用|未使用|  
|  
|  
|1:未使用,2:使用|使用（1版本和2版本的使用长度不一样）|使用（传0）|使用（传0）|使用|使用（1版本和2版本的使用长度不一样）|使用|未使用|返回数据的字节长度|返回窗口的字节大小|使用|
|LOB_CLOSE|使用|未使用|  
|  
|  
|1:未使用,2:使用|使用（1版本和2版本的使用长度不一样）|使用（传0）|使用（传0）|使用|使用（1版本和2版本的使用长度不一样）|使用|未使用|返回数据的字节长度|未使用|使用|
|LOB_OPEN|未使用|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|LOB_TMP_FREE|未使用|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|LOB_ISOPEN|未使用|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|


### 6. Testcases（自测用例）

1 blob clob 支持从任意位置（lob长度范围内）写入数据

2 knlLob 支持写数据

3 支持trimLob的操作

4 clob字符的位置和长度涉及所有的参数返回结果,特别是中英文混合情况

5 knlLob更新会写数据库，数据是更新后的数据；事务回滚后，数据是更新前的数据，回滚生效。

6. 支持追加数据，追加lob.

7 只申请lob不创建，调用lob读写接口

8. 不同类型的lob append接口

9 lob接口调用一半，更改env字符集，继续操作lob ,特别是读操作。

10 loblocator重复关闭

11 lob不close直接close conn,然后再close loblocator.

12 多行查询，分别绑定读取lob

13 兼容性测试

14 JDBC的兼容性测试

### 7. Workload（工作量）

  
  评估代码量KLOC、工作量（人天）。

业务代码400行左右，工作量15人天。

  


### 8. TODO（遗留问题）    
  说明本方案遗留的问题或下一步需要解决的问题。

无