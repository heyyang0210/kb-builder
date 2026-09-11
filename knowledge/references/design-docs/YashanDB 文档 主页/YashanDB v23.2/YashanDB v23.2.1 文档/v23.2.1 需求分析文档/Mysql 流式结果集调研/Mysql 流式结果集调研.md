Created by 苏文, last modified on 十月 30, 2023

  


### 1 mysql三种结果集获取方式

|结果集获取方式|说明|优缺点|Yashan|
|---|---|---|---|
|全部读取（默认）|服务端发送全部数据，客户端读取全部数据；,之后响应应用|1 数据量大时客户端可能内存溢出；,2 JDBC缓存完所有结果行才响应应用；,3 一次拿到所有表数据，结果集不受之后DML影响,  
|不支持；,returnResult隐式结果集与Mysql这种模式类似|
|useCursorFetch|开启客户端cursor fetch模式；一次fetch的行数由 fetchSize决定|1 对数据库影响时间可控；,2 客户端自行定制 fetch粒度；|支持；,但 fetchSize在第二个报文开始失效。|
|stream读取|开启后服务端连续发送行数据（单行连续发送）|1 响应快，客户端收到1行结果后就可以响应应用；,2 数据量很大时，fetch性能很好；,3 可能阻塞服务端，可能对各种锁占用时间较长；net_write_timeout 控制最大阻塞时长，默认600 秒,  
|尚未支持|


stream 模式，Socket Send/Recv Buffer

![](https://pic3.zhimg.com/80/v2-4a622167ca8dc60140a4985b8df7cf92_720w.webp?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFBQUFBQUFBQUFBRUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFnQUFBQUJBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI0MjcsImV4cCI6MTc4MjMxMzIyN30.ww21b5kdGSiGaLsjmLtVKy_xgNQ0jrAxUVzhrsx9CTo)

useCursorFetch模式，固定粒度，需要多次请求

![](https://pic1.zhimg.com/80/v2-6a60de90ecec5640abfbe934b117a4cc_720w.webp?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFBQUFBQUFBQUFBRUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFnQUFBQUJBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI0MjcsImV4cCI6MTc4MjMxMzIyN30.ww21b5kdGSiGaLsjmLtVKy_xgNQ0jrAxUVzhrsx9CTo)

### 2 流式fetch

#### 2.1 阻塞超时

mysql 服务端配置 net_write_timeout 决定最大阻塞时长；

对于JDBC，是在建立连接时通过 netTimeoutForStreamingResults 参数配置流结果集场景下服务端的最大阻塞时长，内部代码根据该配置值，设置服务端 net_write_timeout 

如阻塞超时，mysql服务端直接退出阻塞流程，开始响应其他命令；现有连接socket中已发送的packet也不做任何处理，连接关闭：

![](https://pingcode.yasdb.com/atlas/files/public/67396c93a1ad9a3311dc8b6a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFBQUFBQUFBQUFBRUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFnQUFBQUJBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI0MjcsImV4cCI6MTc4MjMxMzIyN30.ww21b5kdGSiGaLsjmLtVKy_xgNQ0jrAxUVzhrsx9CTo)

Exception in thread "main" java.sql.SQLException: Error retrieving record: Unexpected Exception:     [java.io](http://java.io)    .EOFException message given: Can not read response from server. Expected to read 2,016 bytes, read 51 bytes before connection was unexpectedly lost.

Nested Stack Trace:

  
  ** BEGIN NESTED EXCEPTION **

  [java.io](http://java.io)    .EOFException    
  MESSAGE: Can not read response from server. Expected to read 2,016 bytes, read 51 bytes before connection was unexpectedly lost.

STACKTRACE:

  [java.io](http://java.io)    .EOFException: Can not read response from server. Expected to read 2,016 bytes, read 51 bytes before connection was unexpectedly lost.    
  at com.mysql.cj.protocol.FullReadInputStream.readFully(FullReadInputStream.java:67)    
  at com.mysql.cj.protocol.a.SimplePacketReader.readMessage(SimplePacketReader.java:108)    
  at com.mysql.cj.protocol.a.SimplePacketReader.readMessage(SimplePacketReader.java:45)    
  at com.mysql.cj.protocol.a.TimeTrackingPacketReader.readMessage(TimeTrackingPacketReader.java:57)    
  at com.mysql.cj.protocol.a.TimeTrackingPacketReader.readMessage(TimeTrackingPacketReader.java:41)    
  at com.mysql.cj.protocol.a.MultiPacketReader.readMessage(MultiPacketReader.java:61)    
  at com.mysql.cj.protocol.a.MultiPacketReader.readMessage(MultiPacketReader.java:44)    
  at com.mysql.cj.protocol.a.ResultsetRowReader.read(ResultsetRowReader.java:75)    
  at com.mysql.cj.protocol.a.ResultsetRowReader.read(ResultsetRowReader.java:42)    
  at com.mysql.cj.protocol.a.NativeProtocol.read(NativeProtocol.java:1577)    
  at com.mysql.cj.protocol.a.result.ResultsetRowsStreaming.next(ResultsetRowsStreaming.java:193)    
  at com.mysql.cj.protocol.a.result.ResultsetRowsStreaming.close(ResultsetRowsStreaming.java:115)    
  at com.mysql.cj.jdbc.result.ResultSetImpl.realClose(ResultSetImpl.java:1870)    
  at com.mysql.cj.jdbc.result.ResultSetImpl.close(ResultSetImpl.java:524)    
  at Main.testMysqlStreamResult(Main.java:1456)    
  at Main.main(Main.java:1469)

  
  ** END NESTED EXCEPTION **

  
  at com.mysql.cj.jdbc.exceptions.SQLError.createSQLException(SQLError.java:129)    
  at com.mysql.cj.jdbc.exceptions.SQLError.createSQLException(SQLError.java:97)    
  at com.mysql.cj.jdbc.exceptions.SQLExceptionsMapping.translateException(SQLExceptionsMapping.java:122)    
  at com.mysql.cj.jdbc.exceptions.SQLExceptionsMapping.translateException(SQLExceptionsMapping.java:131)    
  at com.mysql.cj.jdbc.result.ResultSetImpl.realClose(ResultSetImpl.java:1872)    
  at com.mysql.cj.jdbc.result.ResultSetImpl.close(ResultSetImpl.java:524)    
  at Main.testMysqlStreamResult(Main.java:1456)    
  at Main.main(Main.java:1469)

  


  


客户端之后的与服务端交互会发生协议错误。

  


#### 2.2 客户端关闭结果集

JDBC若开启流式结果集，则在开始其他查询或关闭结果集时，丢弃本次查询的所有报文

![](https://pingcode.yasdb.com/atlas/files/public/67396c938970c2af4f520cf9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFBQUFBQUFBQUFBRUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFnQUFBQUJBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI0MjcsImV4cCI6MTc4MjMxMzIyN30.ww21b5kdGSiGaLsjmLtVKy_xgNQ0jrAxUVzhrsx9CTo)

  


  


  


  


  


调研测试用例：

public static   Connection   getMysqlConnection  () {    
      Connection connection =   null;    
    
      try   {    
          String url=  "jdbc:mysql://192.168.7.134:3306/test?netTimeoutForStreamingResults=60"  ;    
            String user=  "root"  ;    
            String password=  "123456"  ;    
    
            Class.  forName  (  "com.mysql.cj.jdbc.Driver"  )  ;    
            connection = DriverManager.  getConnection  (url  ,   user  ,   password)  ;    
    
        }   catch   (ClassNotFoundException e) {    
          e.printStackTrace()  ;    
            System.  out  .println(  "load mysql driver failed."  )  ;    
        }   catch   (Exception e) {    
          e.printStackTrace()  ;    
            System.  out  .println(  "fail to connect to mysql."  )  ;    
        }    
    
  return   connection  ;    
  }    
    


public static void   preMysqlCreateData  (Connection mysqlConn)   throws   SQLException {    
      Statement statement = mysqlConn.createStatement()  ;    
    
        statement.execute(  "drop table if exists test_stream_t1"  )  ;    
        statement.execute(  "create table test_stream_t1(  id   int  ,   c1   varchar  (2500))"  )  ;    
    
        /*PreparedStatement preparedStatement = mysqlConn.prepareStatement("insert into test_stream_t1 values(?, ?)");    
      StringBuilder stringBuilder = new StringBuilder();    
      for (int i = 0; i < 2000; i++) {    
          stringBuilder.append('a');    
      }    
      String insertStr = stringBuilder.toString();    
    
      for (int i = 1; i <= 100000; i++) {    
          preparedStatement.setInt(1, i);    
          preparedStatement.setString(2, "test " + i + " " + insertStr);    
          preparedStatement.execute();    
      }*/    
    
        statement.execute(  "create procedure   prepare_stream_data  ()  \n  "   +    
  "    begin  \n  "   +    
  "    declare i int;  \n  "   +    
  "    set i = 0;  \n  "   +    
  "    while i < 100000 do  \n  "   +    
  "        insert into test_stream_t1 values(i, lpad('test ', 2000, 'a'));  \n  "   +    
  "        set i=i+1;  \n  "   +    
  "    end while;  \n  "   +    
  "    end;"  )  ;    
        statement.execute(  "call prepare_stream_data"  )  ;    
    
        mysqlConn.commit()  ;    
    
        //preparedStatement.close();    
        statement.close()  ;    
  }    
    


public static void   testMysqlStreamResult  (Connection mysqlConn)   throws   Exception {    
  //preMysqlCreateData(mysqlConn);    
    
        Statement statement = mysqlConn.createStatement()  ;    
        ((StatementImpl)statement).enableStreamingResults()  ;    
    
        ResultSet resultSet = statement.executeQuery(  "select   *   from test_stream_t1"  )  ;    
    
      while   (resultSet.next()) {    
          System.  out  .println(resultSet.getInt(  1  ))  ;    
            System.  out  .println(resultSet.getString(  2  ))  ;    
            Thread.  sleep  (  2   *   60   *   1000  )  ;    
          break;    
        }    
    
      resultSet.close()  ;    
        statement.setFetchSize(  100  )  ;    
        ResultSet resultSet2 = statement.executeQuery(  "select   count  (  *  ) from test_stream_t1"  )  ;    
        resultSet2.next()  ;    
        System.  out  .println(resultSet2.getInt(  1  ))  ;    
        resultSet2.close()  ;    
    
  }

  
    


  


  


  


## Attachments: