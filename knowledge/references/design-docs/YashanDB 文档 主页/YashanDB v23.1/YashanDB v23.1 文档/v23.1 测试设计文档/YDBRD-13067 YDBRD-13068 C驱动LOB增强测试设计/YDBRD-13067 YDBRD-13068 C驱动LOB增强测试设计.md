Created by 马文英, last modified by  孔珂煜 on 十一月 13, 2023

# SR

  [[YDBRD-13068] 【驱动】c和jdbc对lob发送机制优化 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13068)  

  [[YDBRD-13067] 【驱动】c驱动lob接口增强，lob协议升级和jdbc驱动适配 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13067)  

  [YDBRD-13067](https://jira.yasdb.com/browse/YDBRD-13067?src=confmacro)    -  【驱动】c驱动lob接口增强，lob协议升级和jdbc驱动适配  完成

  [YDBRD-13068](https://jira.yasdb.com/browse/YDBRD-13068?src=confmacro)    -   【驱动】c和jdbc对lob发送机制优化  完成

  


# 变动点：

1.  新增接口 9个


|接口名|说明|
|---|---|
|yacLobIsTemporary|判断临时 locator|
|yacLobRead2|按偏移位置读取指定大小lob到buffer|
|yacLobWrite2|按偏移位置将buffer中数据写到lobLocator|
|yacLobWriteAppend|在lobLcator末尾追加数据|
|yacLobTrim|截断lob|
|yacLobAppend|在一个lob末尾追加另一个临时lob，不能是同一个lob|
|YacDescAlloc|申请lobLocator|
|YacDescFree|释放lobLocator|
|yacLobCreateTemporary2|创建指定类型的临时lob|


1.  修改接口2个


|接口名|说明|
|---|---|
|yacLobDescAlloc|申请lobLocator不指定类型|
|yacLobDescFree|  
|
|yacLobCreateTemporary|创建临时lob不指定类型|


# LOB接口使用流程

## 读lob

1. 建立连接
1. 初始化statment
1. 申请 lobLocator:      YacDescAlloc 
1. 执行 查询语句
1. 绑定 lobLocator到DQL投影列 ： yacBindColumn
1. fetch数据
1. 从LobLocator 读lob到缓冲区 ： yacLobRead
1. 释放lob: YacDescFree
1. 释放statment
1. 关闭连接


  


## 写LOB

1. 建立连接
1. 初始化statment
1. 申请 lobLocator: 
1. 给lobLocator  创建 临时lob：    yacLobCreateTemporary2
1. 写数据到 lobLocator:   yacLobWrite
1. 绑定 lobLocator 到dml:   yacBindParameter
1. 执行dml
1. 释放lob：YacDescFree
1. 释放statment
1. 关闭连接


  


规格：

chunkSize: 8100 byte, 可设置

单行转流传输单行数据长度: 32000 byte，长度值限制

lob转流传输: 8100 byte

  


GBK 测试需要考虑重新建库

# 测试设计

## 场景

行表。列表？

## 系统

linux, arm, windows

## 功能测试

|  
|接口|参数|用例|预期|
|---|---|---|---|---|
|1|yacLobIsTemporary    
    
|Conn ,Locator ,Bool,  
    
|Conn: 已连接,Locator: 绑定DQL查询列|Bool: False|
||||Conn: 已连接,Locator: 绑定临时LOB|Bool: True|
||||Conn: 已连接,Locator: Desc未绑定DQL列和临时LOB|Bool: False|
||||Conn: 已连接,Locator:  申请自 conn2 |测试结果： 正常， 没有报错|
||||Conn: 已连接,申请locator    
  Conn: 关闭|测试结果： 正常，没有报错|
||||Conn: 已连接,Locator:  申请后，释放|测试结果： 正常，没有报错|
||||Conn: 已连接,Locator:   非合法locator|测试结果： 正常，没有报错|
|2|yacLobRead2|##### hConn,##### Locator,##### byteSize,##### charSize,##### offset,##### buf,##### bufLen,  
    
    
|读取Clob/Blob,charSize/byteSize <= bufLen,charSize/byteSize > bufLen,charSize/byteSize = 0,charSize/byteSize = 0,charSize/byteSize > 32000,  
,charSize/byteSize > lobSize,charSize/byteSize < lobSize,charSize/byteSize = lobSize,  
|  
|
|3|  
||读取Clob/Blob,offset < lobsize,offset > lobsize,offset = lobsize|  
|
|4|  
||offset + charSize/byteSize  跨chunk|  
|
|5|  
||多次读offset重叠|  
|
|6|  
||  
,字符集utf8/gbk,客户端和服务端一致,客户端和服务端不一致|  
|
|7|  
||Locator 是 Clob,byteSize = 0,  charSize = 0,byteSize > 0,  charSize = 0,byteSize > 0,  charSize > 0|  
|
|8|  
||Locator没返回数据,Locator返回数据NULL|  
|
|9|  
||Locator 是tempLocator|  
|
|10|  
||通过不同conn |数据库不core|
|11|  
||  
|  
|
|12|yacLobWrite2|hConn,Locator,byteSize,charSize,buff,buflen,  
    
|写Clob/Blob,charSize/byteSize <= bufLen,charSize/byteSize > bufLen,charSize/byteSize = 0,charSize/byteSize = 0,charSize/byteSize > 32000,  
,charSize/byteSize > lobSize,charSize/byteSize < lobSize,charSize/byteSize = lobSize|  
|
|13|  
||offset < lobsize,offset > lobsize,offset = lobsize|  
|
|14|  
||offset + charSize/byteSize  跨chunk|  
|
|15|  
||多次写 offset重叠 |  
|
|16|  
||字符集utf8/gbk,客户端和服务端一致,客户端和服务端不一致|  
|
|17|  
||Locator 是 Clob,byteSize = 0,  charSize = 0,byteSize > 0,  charSize = 0,byteSize > 0,  charSize > 0|  
|
|18|  
||Locator 不是tempLocator|  
|
|19|  
||通过不同conn |数据库不core|
|20|  
|  
|  
|  
|
|21|yacLobWriteAppend|hConn,Locator,byteSize,charSize,buff,buflen|追加Clob/Blob,charSize/byteSize <= bufLen,charSize/byteSize > bufLen,charSize/byteSize = 0,charSize/byteSize = 0,charSize/byteSize > 32000,  
,charSize/byteSize > lobSize,charSize/byteSize < lobSize,charSize/byteSize = lobSize|  
|
|22|  
|  
|字符集utf8/gbk,客户端和服务端一致,客户端和服务端不一致|  
|
|23|  
|  
|Locator 是 Clob,byteSize = 0,  charSize = 0,byteSize > 0,  charSize = 0,byteSize > 0,  charSize > 0|  
|
|24|  
|  
|Locator 不是tempLocator|  
|
|25|  
|  
|通过不同conn |数据库不core|
|26|  
|  
|  
|  
|
|27|yacLobTrim|hConn,Locator,newLen|截断 Clob/Blob,newLen > lobSize,newLen <= lobSize,newLen > lob规格,newLen = 0,  
|  
|
|28|  
||Locator 是tempLocator|  
|
|29|  
||Locator 不是tempLocator|  
|
|30|  
||free 后 trim|  
|
|31|  
||Locator 未绑定 temp 或 投影|  
|
|32|  
||多次trim  ,newLen 递增,newLen 递减,增减组合|  
|
|33|  
||字符集utf8/gbk,客户端和服务端一致,客户端和服务端不一致|  
|
|34|  
|  
|  
|  
|
|35|yacLobAppend|hConn,dstLob,srcLob|dstLob :   Clob,srcLob:     Clob|  
|
|36|  
|  
|dstLob :   Blob,srcLob:     Blob|  
|
|37|  
|  
|dstLob :   Clob,srcLob:     Blob|报错|
|38|  
|  
|dstLob :   Blob,srcLob:     Clob|报错|
|39|  
|  
|dstLob 和 srcLob 指向同一个 Lob|报错|
|40|  
|  
|dstLob 和 srcLob 有一个是非法 Lob,dstLob 和 srcLob 都非法 Lob|报错|
|41|  
|  
|字符集utf8/gbk,客户端和服务端一致,客户端和服务端不一致|  
|
|42|  
|  
|srcLob是kernellob|报错|
|43|  
|  
|dstlob是 kernellob,srclob是 templob|  
|
|44|YacDescAlloc|hConn,Desc,type|type: blob|  
|
|45|  
|  
|type: clob|  
|
|46|  
|  
|通过不同conn|数据库不core|
|47|YacDescFree|hConn,Desc,type,  
    
    
|desc: blob,type: blob|  
|
|48|  
||desc: clob,type: clob|  
|
|49|  
||desc: blob,type: clob|  
|
|50|  
||desc: clob,type: blob |  
|
|51|  
||通过不同conn访问同一locator|数据库不core|
|52|  
|  
|  
|  
|
|53|yacLobCreateTemporary|hConn,loc|loc:   YacDescAlloc  创建的blob|  
|
|54|  
||loc:   YacDescAlloc  创建的clob|  
|
|55|  
|  
|  
|  
|
|56|yacLobCreateTemporary2|hConn,loc,lobType,  
    
    
    
|yacLobDescAlloc 创建的blob|  
|
|57|  
||YacDescAlloc  创建的blob,lobType: blob    
|  
|
|58|  
||loc:   YacDescAlloc  创建的clob,lobType: clob|  
|
|59|  
||YacDescAlloc  创建的blob, , lobType: clob|  
|
|60|  
||YacDescAlloc  创建的blob, , lobType: blob|  
|
|61|  
|  
|  
|  
|


兼容性测试

|  
|  
|预期|  
|
|---|---|---|---|
|1|22.2版本用例通过新驱动可以正常访问 22.2， 23.1版本数据库|正常访问|  
|
|2|23.1新接口访问 22.2数据库|数据库不core|  
|


优化：

|  
|优化点|说明|  
|
|---|---|---|---|
|1|outrow从服务端获取lob长度,接口：yacLobGetLength |inrow:,lobsize<= 行4000， 列  32000|lob为空|
|  
|  
|outrow:,lobsize >  行4000， 列32000|lob maxsize|
|  
|  
|  
|read前|
|  
|  
|  
|read后|
|  
|  
|  
|read部分后|
|  
|  
|  
|多行lob|
|  
|  
|  
|  
|
|2|lob 支持stream方式传输,yacLobWrite2,yacLobWriteAppend,yacLobAppend|传输方式：,普通传输，stream传输，lob传输    
    
  写入lob大于chunsize使用stream传输|单次写数据大于chunksize|
|  
|||单次写数据小于chunsize|
|  
|||多次写入部分大于chunksize|
|  
|||并发写不同lob|
|  
|||  
|
|  
|  
|  
|  
|
|3|新旧版本性能对比，oracle|规范性能测试场景|  
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


用例

|接口|用例|说明|  
|
|---|---|---|---|
|yacLobWriteAppend|test_lob_wa01|write append temp clob/blob|inline lob|
|  
|test_lob_wa02|write append temp clob/blob|outofline lob|
|  
|test_lob_wa03|单次write append的大小>32000|  
|
|  
|test_lob_wa04|write append after trim temp lob|  
|
|  
|test_lob_wa05|write append kernel lob|  
|
|  
|test_lob_wa10|invalid lob,size > bufferlen,size = 0|一些非法用法|
|yacLobTrim|test_lob_trim01|trim temp clob/blob;  newlen = 0|  
|
|  
|test_lob_trim02|lobwrite after trim 0|  
|
|  
|test_lob_trim03|大lob trim多次|  
|
|  
|test_lob_trim04|10000次trim|  
|
|  
|test_lob_trim05|不create temp 直接trim,释放侯trim|一些非法用法|
|  
|test_lob_trim06|templob1 释放后,申请templob2, trimlob1修改了lob2的数据|  
|
|  
|test_lob_trim07|trim kernel lob|  
|
|yacLobAppend|test_lob_apd01|append temp clob/blob|  
|
|  
|test_lob_apd02| 大lob append后写入数据库|  
|
|  
|test_lob_apd03|/*outof line kernel lob append*/|  
|
|  
|test_lob_apd04|inline kernel lob append|  
|
|  
|test_lob_apd05|kernel lob is null|?|
|  
|test_lob_apd08|dstlob = srclob,src lob = kernel lob|限制|
|  
|test_lob_apd09|空lob append|  
|
|  
|test_lob_apd10|lob申请不创建,lob类型不同,lob类型相同,lob申请后创建,        相同lob,        lob类型不同|一些非法用法|
|yacLobRead2|test_lob_r01|read 不同长度|  
|
|  
|test_lob_r02|lobsize和 buffer不一致|  
|
|  
|test_lob_r03|读tempLob|  
|
|  
|test_lob_r04|  
|  
|
|  
|test_lob_r05|读大lob|  
|
|yacLobWrite2|test_lob_w01|不同的参数取值|  
|
|  
|test_lob_w02|绑定参数|  
|
|  
|test_lob_w03|多次写入|  
|
|  
|test_lob_w04|  
|  
|
|  
|test_lob_w05|trim后write|  
|
|  
|test_lob_w06 |通过不同conn 写|  
|
|  
|test_lob_w07|写入大lob|  
|
|  
|test_lob_w08|字符完整性校验|  
|
|  
|test_lob_w09 |指定offset多次写入|  
|
|  
|test_lob_w10|byteSize >charsize 不一致|  
|
|  
|test_lob_w11|异常，lob申请未创建|  
|
|yacLobIsTemporary|test_lob_t01|yacLobDescAlloc + （yacLobCreateTemporary/,yacLobCreateTemporary2)|  
|
|  
|test_lob_t02|yaDescAlloc + （yacLobCreateTemporary/,yacLobCreateTemporary2)|  
|
|  
|test_lob_t03|kernelLob|  
|
|  
|test_lob_t04|只申请不创建|  
|
|  
|test_lob_t05|不同conn访问同一lob|  
|
|  
|test_lob_t06|env, conn都不同|  
|
|  
|test_lob_t07|断连后判断|  
|
|  
|test_lob_t08|异常参数|  
|
