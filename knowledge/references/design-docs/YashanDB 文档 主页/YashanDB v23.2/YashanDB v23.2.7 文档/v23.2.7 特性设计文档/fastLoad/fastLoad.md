Created by 侯忠林, last modified on 九月 12, 2024

## 1. Overview（概述）

spark生态对接目前直接调用JDBC接口进行数据导入，在分布式场景下，相较于业界其他工具，导入性能较差。

参考yasldr性能好，使用批量插入的协议。但是JDBC目前不支持像yasldr那样的批量插入的协议，所以需要一版java版本的fastLoad，提供像yasldr的功能一样，提升数据导入性能。

  [Java支持批量导入方案设计 - 贺国锋 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156135925)  

  [fastLoad方案 - 侯忠林 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159421425)  

## 2. Features（功能特性）

1. 支持基础的导入数据功能
1. 支持分布式按照DN节点导入功能
1. 支持批量导入功能（batchInset协议，单机不分区，一级分区，二级分区）。
1. 支持分布式批量导入功能（batchInset协议，DN节点，一级分区，二级分区）。


## 3. Interfaces（接口）

|接口|参数|调用|说明|
|---|---|---|---|
|FastLoader generatefastLoader(String mode,String,ipPort, Properties info) throws SQLException;|1. mode  模式，支持基础模式basic，批量插入模式 batch
1. ipPort要插入的数据库ipPort
1. info 相关连接参数，或者load参数
|FastLoader fLoad = FastLoaderFactory.generatefastLoader(mode, ipPort, info);|创建对应模式的fastLoader|
|void prepare(String tableName) throws SQLException;|tableName 要导入的表名|fLoad.prepare("table1");|准备执行|
|void execute() throws SQLException, ClassNotFoundException;|  
|fLoad.execute();|开始执行|
|boolean putData(List<List<Object>> data) throws SQLException;|- data 表要插入的数据
- List<VarInfo> 表示要插入的某一行数据
- VarInfo 表示要插入的某一行某一列的数据
|fLoad.putData(data);,也可循环调用，确保传入数据成功,while(!fLoad.putData(data)) {    
      Thread.sleep(3000);    
  }|传入的数据，在fastLoad结束前可以多次调用，达到最大个数的话，就返回false，put成功返回true|
|void abort();|立即结束|fLoad.abort();|强行中断当前进度|
|void finish() throws SQLException;|非阻塞|fLoad.finish();|结束输入导入数据|
|void close(long timeout, TimeUnit unit) throws InterruptedException;|1. timeout 超时时间
1. unit 超时单位
|fLoad.close();|关闭FastLoader，释放资源（阻塞式，等待发送线程数据发送完成关闭）|
|LoaderProgress getProgre  ss();|获取执行进度信息|fLoad.getProgress();|返回LoadProgress接口（实现获取详细数据）|
|void setColumnNames(columnNames)|columnNames 要插入的数据列，以逗号隔开（按照sql的格式提供）|fLoad.setColumnNames("clo1,clo2,clo3");|需要在执行prepare之前设置，如果不设置默认执行插入所有行|
|void setSenderCount(int senderCount) throws SQLException;|senderCount 发送线程的个数|fLoad.setSenderCount(10);|设置发送线程的个数,默认2个|
|void setReaderCount(int readerCount) throws SQLException;|readerCount 读数据线程的个数|fLoad.setReaderCount(10);|设置读数据线程的个数（默认2个）|
|void setCommitCount(int commitCount) throws SQLException;|commitCount 提交Commit的个数|fLoad.setCommitCount(10000);|设置提交Commit的个数，默认中途不提交，插入完成后才提交,,commitCount为0时表示设置bulkLoad属性，不再中途提交，只有lsc表生效|
|void setSendCountAtOnce(int sendCountAtOnce);|sendCountAtOnce 批量一次发送数据的个数|fLoad.setSendCountAtOnce(10000);|设置批量一次发送数据的个数，默认4000|
|void setMaxWaitLineCount(int maxWaitLineCount) throws SQLException;|maxWaitLineCount 等待send的数据最大行数|fLoad.setMaxWaitLineCount(10000);|设置等待send的数据最大行数,为0时表示不控制|
|void setIsDeduplicated(boolean deduplicated) throws SQLException;|deduplicated设置重复数据|fLoad.setIsDeduplicated(true);|在batch模式下，lsc表在设置了bulkLoad以后可以设置deduplicated属性，表示是否插入重复数据，默认false|


执行进度信息LoadProgress 有如下接口：

|接口|说明|
|---|---|
|int getTotalCount();|获取全部数据个数（行）|
|int getErrorCount();|获取执行错误个数（行）|
|int getInsertedCount();|获取已经插入个数（行）|
|double   getPercentage();|获取执行进度百分比（0-100）|
|StringBuffer getErrorMsg();|获取所有错误信息（操作buffer获取具体错误）|


## 4. Limitations（功能限制）

目前特殊类型的数据不支持导入，如UDT。

大数据量的Lob导入性能差（依靠string和bites插入）。

## 5. Detail Design（详细设计）

### 5.1 Architecture（架构）

![](https://pingcode.yasdb.com/atlas/files/public/67396e11a1ad9a3311dc94fd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBQUFBQUVBQUFBQUFDQVFBQUFDQUFBQUFBQVFBQUFEaENBQUFBQUFBQWdBQUFBQUVBQUFBQUFBb0FBQkFCQUFBQWdBQUFBQUVBQUFBQUlJQUFRUWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFFSUFBQUFBUUFBQ0FBQUFCQUFBQUFJQUFBQUFBQUFEQUVDQ0VBQUFBVUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM5ODYsImV4cCI6MTc4MjMyNDc4Nn0.cn95vAc9O_WBRWZrFIRi9v-kf8yfuJGB9t9jX1fnAcM)

### 5.2 Data Structures & Flow（数据结构与流程）

接口调用图

![](https://pingcode.yasdb.com/atlas/files/public/67396e118970c2af4f52168d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBQUFBQUVBQUFBQUFDQVFBQUFDQUFBQUFBQVFBQUFEaENBQUFBQUFBQWdBQUFBQUVBQUFBQUFBb0FBQkFCQUFBQWdBQUFBQUVBQUFBQUlJQUFRUWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFFSUFBQUFBUUFBQ0FBQUFCQUFBQUFJQUFBQUFBQUFEQUVDQ0VBQUFBVUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM5ODYsImV4cCI6MTc4MjMyNDc4Nn0.cn95vAc9O_WBRWZrFIRi9v-kf8yfuJGB9t9jX1fnAcM)

fastLoad数据结构图

![](https://pingcode.yasdb.com/atlas/files/public/67396e11a1ad9a3311dc94fe/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBQUFBQUVBQUFBQUFDQVFBQUFDQUFBQUFBQVFBQUFEaENBQUFBQUFBQWdBQUFBQUVBQUFBQUFBb0FBQkFCQUFBQWdBQUFBQUVBQUFBQUlJQUFRUWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFFSUFBQUFBUUFBQ0FBQUFCQUFBQUFJQUFBQUFBQUFEQUVDQ0VBQUFBVUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM5ODYsImV4cCI6MTc4MjMyNDc4Nn0.cn95vAc9O_WBRWZrFIRi9v-kf8yfuJGB9t9jX1fnAcM)

![](https://pingcode.yasdb.com/atlas/files/public/67396e118970c2af4f52168e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBQUFBQUVBQUFBQUFDQVFBQUFDQUFBQUFBQVFBQUFEaENBQUFBQUFBQWdBQUFBQUVBQUFBQUFBb0FBQkFCQUFBQWdBQUFBQUVBQUFBQUlJQUFRUWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFFSUFBQUFBUUFBQ0FBQUFCQUFBQUFJQUFBQUFBQUFEQUVDQ0VBQUFBVUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM5ODYsImV4cCI6MTc4MjMyNDc4Nn0.cn95vAc9O_WBRWZrFIRi9v-kf8yfuJGB9t9jX1fnAcM)

![](https://pingcode.yasdb.com/atlas/files/public/67396e11a1ad9a3311dc94ff/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBQUFBQUVBQUFBQUFDQVFBQUFDQUFBQUFBQVFBQUFEaENBQUFBQUFBQWdBQUFBQUVBQUFBQUFBb0FBQkFCQUFBQWdBQUFBQUVBQUFBQUlJQUFRUWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFFSUFBQUFBUUFBQ0FBQUFCQUFBQUFJQUFBQUFBQUFEQUVDQ0VBQUFBVUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM5ODYsImV4cCI6MTc4MjMyNDc4Nn0.cn95vAc9O_WBRWZrFIRi9v-kf8yfuJGB9t9jX1fnAcM)

实现：

1. 整体的sender和reader为标准的生产者消费者模型设计，reader为生产者，sender为消费者。
1. sender线程在execute之后启动，在abort或者在reader线程池关闭后，并且数据发送完，结束sender线程。
1. reader在每一次putData以后启动新线程，加入线程池队列尾部，处理完当前putData的数据后结束线程。在finish之后不在增加新的线程任务，执行完线程任务后线程池关闭。
1. errorMsg类型为StringBuffer，线程安全，在用户调用getProgress以后拿到StringBuffer，可操作或者需要的错误信息。
1. reader主要作用为，校验数据正确性（数据个数，补全缺失的列），计算节点，分区。
1. sender主要的作用是按照不同节点，不同分区拿到数据，通过基础模式或者batchInsert模式插入数据，拿到数据返回的错误信息。
1. tableInfo的主要作用是按照当前的模式，还有表分区，拿到基础的表数据信息，保存所有的待发送数据，增加并发锁，保证这个reader和sender线程之间的数据一致性。


优点：

1. reader的线程个数取决于用户调用putData的次数，什么时候启动新线程由用户决定。
1. 用户可以在初期少次大批量的putData将数据全部同步到fastLoader，finish后释放reader资源，sender资源利用率更高，发送数据更快。
1. 发送数据整体性能会高一点。


缺点：

1. 用户putData的时机不好控制，在putData的次数过多的情况下会有更多的线程。
1. 数据一次性塞入内存，导致allData数据过大，内存占用过高（如果JVM内存较低，频繁触发full GC反而性能更差），虽然可以通过setMaxWaitLineCount设置影响allData的个数，但是不好操作（空间不太好计算）。
1. putData过多的情况下的多线程，如果频繁的拉起新线程或者切换线程，反而更消耗性能（待验证），也可能出现在短时间内频繁putData出现CPU暴涨（瞬间拉起多个新线程）。


![](https://pingcode.yasdb.com/atlas/files/public/67396e11a1ad9a3311dc9500/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBQUFBQUVBQUFBQUFDQVFBQUFDQUFBQUFBQVFBQUFEaENBQUFBQUFBQWdBQUFBQUVBQUFBQUFBb0FBQkFCQUFBQWdBQUFBQUVBQUFBQUlJQUFRUWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFFSUFBQUFBUUFBQ0FBQUFCQUFBQUFJQUFBQUFBQUFEQUVDQ0VBQUFBVUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM5ODYsImV4cCI6MTc4MjMyNDc4Nn0.cn95vAc9O_WBRWZrFIRi9v-kf8yfuJGB9t9jX1fnAcM)

![](https://pingcode.yasdb.com/atlas/files/public/67396e118970c2af4f52168f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBQUFBQUVBQUFBQUFDQVFBQUFDQUFBQUFBQVFBQUFEaENBQUFBQUFBQWdBQUFBQUVBQUFBQUFBb0FBQkFCQUFBQWdBQUFBQUVBQUFBQUlJQUFRUWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFFSUFBQUFBUUFBQ0FBQUFCQUFBQUFJQUFBQUFBQUFEQUVDQ0VBQUFBVUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM5ODYsImV4cCI6MTc4MjMyNDc4Nn0.cn95vAc9O_WBRWZrFIRi9v-kf8yfuJGB9t9jX1fnAcM)

实现：

1. reader线程execute之后启动，数量固定不变。
1. putData之后将原始数据插入originalData队列
1. reader线程每次从originalData里面拿到固定数量的数据，处理数据（校验和计算分区）到allData里面。


优点：

1. reader的线程个数固定，更好控制，可以设置reader和sender的线程比。
1. reader的生产者速度可能比sender的消费者速度慢。
1. 插入性能不会出现突然的变动。
1. putData过多的情况下更好控制，也不会出现在突然大量putData时出现CPU波动。
1. 对内存低的情况下更友好，内存要求不高。


缺点：

1. reader的生产者速度可能比sender的消费者速度慢。
1. 整体性能没有上面的快。


### 5.3 实现类图

![](https://pingcode.yasdb.com/atlas/files/public/67396e118970c2af4f521690/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBQUFBQUVBQUFBQUFDQVFBQUFDQUFBQUFBQVFBQUFEaENBQUFBQUFBQWdBQUFBQUVBQUFBQUFBb0FBQkFCQUFBQWdBQUFBQUVBQUFBQUlJQUFRUWdBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFFSUFBQUFBUUFBQ0FBQUFCQUFBQUFJQUFBQUFBQUFEQUVDQ0VBQUFBVUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM5ODYsImV4cCI6MTc4MjMyNDc4Nn0.cn95vAc9O_WBRWZrFIRi9v-kf8yfuJGB9t9jX1fnAcM)

## 6. TODO（遗留问题）

lob的导入性能过差。

大String的绑定无法使用流和隐式lob。

  


## Attachments:

[image2024-7-1_15-35-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTA4OTcwYzJhZjRmNTIxNjg0IiwicmVmX2lkIjoiNjczOTZlMTA3MjgyMDZlZmI5MmYyNTgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzOTg2LCJleHAiOjE3ODI0MDAzODZ9.tmxP7_hvPPnBGxRHuQNupDaMeEdWtKzjHKVnGWaDm4I)

 (image/png)    


[image2024-7-1_18-53-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTBhMWFkOWEzMzExZGM5NGY4IiwicmVmX2lkIjoiNjczOTZlMTA3MjgyMDZlZmI5MmYyNTgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzOTg2LCJleHAiOjE3ODI0MDAzODZ9.J5Uk_dTUxDbFGD3cI9QX2z8u5WhFblEMe7cual4G2Os)

 (image/png)    


[image2024-9-2_15-32-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTFhMWFkOWEzMzExZGM5NGZhIiwicmVmX2lkIjoiNjczOTZlMTA3MjgyMDZlZmI5MmYyNTgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzOTg2LCJleHAiOjE3ODI0MDAzODZ9.F5enJ9X6xjjKfrfZ8CJixZPjoVoVpIXVg7q9kLvHSWo)

 (image/png)    


[image2024-9-2_17-41-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTE4OTcwYzJhZjRmNTIxNjg4IiwicmVmX2lkIjoiNjczOTZlMTA3MjgyMDZlZmI5MmYyNTgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzOTg2LCJleHAiOjE3ODI0MDAzODZ9.RZRncScq-iNc9vvR9CdjRRScnUSd4nS5RmDrZXtwJSo)

 (image/png)    


[image2024-9-3_10-13-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTE4OTcwYzJhZjRmNTIxNjhhIiwicmVmX2lkIjoiNjczOTZlMTA3MjgyMDZlZmI5MmYyNTgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzOTg2LCJleHAiOjE3ODI0MDAzODZ9.wbPic2-MHI46SAGjQpRDqXVpa7jPFTIbxg9ckzDGhd8)

 (image/png)    


[image2024-9-3_10-13-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMTE4OTcwYzJhZjRmNTIxNjhiIiwicmVmX2lkIjoiNjczOTZlMTA3MjgyMDZlZmI5MmYyNTgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzOTg2LCJleHAiOjE3ODI0MDAzODZ9.CKGH9y9bTtxZYHsb09CYx2q_xFU6MNh6WdOtc-vo5_U)

 (image/png)    


## Comments:

|  [](null)  ,按照方案二，固定reader个数的方案实现。,Posted by houzhonglin at 九月 25, 2024 17:22|
|---|
