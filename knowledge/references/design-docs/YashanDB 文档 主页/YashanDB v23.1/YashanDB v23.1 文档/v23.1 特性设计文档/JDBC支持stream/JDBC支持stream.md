Created by 张周玺, last modified on 五月 29, 2023

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

增加对stream的支持。    [[YDBRD-7324] 支持stream的传输机制 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-7324)  

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

支持功能：

参数绑定和查询时，某些特定场景下使用stream机制对数据进行传输。

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

*列出本方案对外提供的接口、配置参数、API等。*

*set接口：*

|接口|说明|
|:---|:---|
|setBytes|根据长度，小于32*1024时直接绑定，大于等于32*1024使用流绑定|
|void   setCharacterStream|如果没传长度参数，  使用 LOB 绑定；,如果传了长度参数：,    如果长度小于32*1024，直接绑定；,    如果大于等于32*1024且小于2*1024*1024*1024，使用流绑定。,    如果大于等于2*1024*1024*1024，  使用 LOB 绑定。|
|void   setAsciiStream|如果没传长度参数，  使用 LOB 绑定；,如果传了长度参数：,    如果长度小于32*1024，直接绑定；,    如果大于等于32*1024，  使用 LOB 绑定。,该接口用于绑定ascii码对应的那些字符，不能绑定除ascii码之外的字符，否则存进去再取出来结果一定是乱码的，无法得到正确的字符串结果。|
|void   setBinaryStream|如果没传长度参数，  使用 LOB 绑定；,如果传了长度参数：,    如果长度小于32*1024，直接绑定；,    如果大于等于32*1024且小于2*1024*1024*1024，使用流绑定。,    如果大于等于2*1024*1024*1024，  使用 LOB 绑定。|
|setString|根据长度，小于32*1024时直接绑定，大于等于32*1024使用流绑定|


**注：**

1. 传了长度参数，长度参数大于数据实际长度的情况，参考Oracle：如果使用流绑定，则读取全部数据，不报错。如果使用lob绑定，则报错。
1. 接口传入的inputStream对象或者reader对象都是不可重复的，否则报错。
1. 传入的length不可为负数，否则报错
1. setAsciiStream不用stream传输，因为存在扩展ascii码报错的问题（Oracle也存在），所以大于32000的都直接用lob绑定了。
1. 走stream的场景校验了入参不能是来自同一个连接的lob对象，因为会导致协议乱掉。（Oracle在这种场景下会报错）


get接口：

|接口|说明|
|---|---|
|getBinaryStream|补充数据类型为stream的场景|
|getUnicodeStream|补充数据类型为stream的场景|
|getAsciiStream|补充数据类型为stream的场景|


##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

  


目前查询流程中没有能支持stream的数据类型，所以get相关的接口都先不动。

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

  


协议设计：

调研了Oracle set接口与数据库类型的对应关系：1代表成功

|  
|clob|blob|long raw|
|---|---|---|---|
|setBytes|0|1|1|
|setString|1|0|0|
|setBinaryStream|0|1|1|
|setCharacterStream|1|0|0|
|setAsciiStream|1|0|0|


**//据以上结果，设计两个数据类型**  **VARCHAR_STREAM和BINARY_STREAM,**  **用于参数绑定和查询过程中标识stream的数据类型**

**使用FE来标识一个流**

## 5.1 绑定流程：

### 5.1.1 jdbc侧数据发送流程

先发送其它数据，等这一条的其它数据全部发送完毕之后，开始发送stream真实数据，stream数据分成n段发送，每一段结构都与之前现有的  **params**  结构保持一致：

**params**  :绑定参数的具体内容，包括绑定参数的长度和数据，paramSize表示共有paramSize行绑定参数

|len(8）|longLen（16）|data|
|:---:|:---:|:---:|


**len**  : 

  0xFF:  null value，没有longLen和data。

  0xFD:  使用longLen表示长度

  <0xFD: len表示实际长度，longlen字段省略

**longlen**  : len为0xFD时，表示data长度，这个长度最大是32767，参考的Oracle。

**data**  ： 内容

每一段不跨包发送。

所有stream结束之后以0结尾。

所以一个32800的stream传输形式如下：

|fd|7f|ff|32767个byte|21|剩余的33个byte|0|
|---|---|---|---|---|---|---|


  


多条数据时stream在每一条数据的最后面，比如多条数据时总的数据顺序如下。

|第一条的正常数据|第一条的stream数据|第二条的正常数据|第二条的stream数据|...后面以此类推|
|---|---|---|---|---|


### 5.1.2 服务端数据接收流程

使用临时Lob接收stream数据。

## 5.2 查询流程：

查询时stream的特点是查询了后一个字段后，前面的stream自动失效，读取时报错。

传输时和绑定一样，先发送其他数据，stream使用FE做标识，stream真实数据放在最后面，stream结构与上面5.1.1保持一致。

  


获取返回值时，stream数据不会在jdbc侧进行缓存，所以如果跳过了stream去读下一个字段，则返回的这个stream数据直接被丢弃，除stream之外的正常数据无论在什么时候都不会被丢弃。

  


## 5.3 兼容性：

新版本jdbc对老版本服务端：由于老版本服务端不支持流协议，所以上面接口涉及streeam传输的场景，在老版本服务端场景下，全部使用lob进行传输.

老版本jdbc对新版本服务端：老版本jdbc没有实现该特性，不涉及兼容性问题.

## .

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

  


开发完成后补充。

##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

  


*评估代码量KLOC、工作量（人天）。*

  


  


##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

不涉及。